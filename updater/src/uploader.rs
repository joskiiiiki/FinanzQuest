use crate::alpaca;
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::collections::HashMap;
use tokio::sync::mpsc;

// Message types for the channel
pub enum UploaderMsg {
    Bars(HashMap<String, Vec<alpaca::Bar>>),
    Flush,
}

pub struct Uploader {
    tx: mpsc::Sender<UploaderMsg>,
    handle: tokio::task::JoinHandle<Result<(), sqlx::Error>>,
}

// Flat row ready for UNNEST insert
struct BarRow {
    symbol: String,
    t: time::OffsetDateTime,
    o: f64,
    h: f64,
    l: f64,
    c: f64,
    v: f64,
    vw: f64,
    n: i64,
}

impl BarRow {
    fn from_bar(symbol: String, bar: alpaca::Bar) -> Result<Self, time::error::Parse> {
        Ok(Self {
            symbol,
            t: time::OffsetDateTime::parse(&bar.t, &time::format_description::well_known::Rfc3339)?,
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c,
            v: bar.v,
            vw: bar.vw,
            n: bar.n as i64,
        })
    }
}

impl Uploader {
    pub async fn new(db_url: &str, batch_size: usize) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(4)
            .connect(db_url)
            .await?;

        let (tx, rx) = mpsc::channel::<UploaderMsg>(64);

        let handle = tokio::spawn(upload_task(pool, rx, batch_size));

        Ok(Self { tx, handle })
    }

    pub async fn send(&self, bars: HashMap<String, Vec<alpaca::Bar>>) {
        if let Err(e) = self.tx.send(UploaderMsg::Bars(bars)).await {
            eprintln!("Uploader channel closed: {e}");
        }
    }

    /// Flush remaining rows and wait for the task to finish
    pub async fn finish(self) -> Result<(), sqlx::Error> {
        let _ = self.tx.send(UploaderMsg::Flush).await;
        drop(self.tx); // close channel so task exits loop
        self.handle.await.expect("uploader task panicked")
    }
}

async fn upload_task(
    pool: PgPool,
    mut rx: mpsc::Receiver<UploaderMsg>,
    batch_size: usize,
) -> Result<(), sqlx::Error> {
    let mut batch: Vec<BarRow> = Vec::with_capacity(batch_size);

    while let Some(msg) = rx.recv().await {
        match msg {
            UploaderMsg::Bars(pages) => {
                for (symbol, bars) in pages {
                    for bar in bars {
                        match BarRow::from_bar(symbol.clone(), bar) {
                            Ok(row) => batch.push(row),
                            Err(e) => eprintln!("Skipping malformed bar: {e}"),
                        }
                    }
                }
                if batch.len() >= batch_size {
                    insert_batch(&pool, &mut batch).await?;
                }
            }
            UploaderMsg::Flush => {
                if !batch.is_empty() {
                    insert_batch(&pool, &mut batch).await?;
                }
            }
        }
    }

    // drain any remainder when channel closes
    if !batch.is_empty() {
        insert_batch(&pool, &mut batch).await?;
    }

    Ok(())
}

async fn insert_batch(pool: &PgPool, batch: &mut Vec<BarRow>) -> Result<(), sqlx::Error> {
    let len = batch.len();

    // unpack into columnar vecs for UNNEST
    let mut symbols = Vec::with_capacity(len);
    let mut ts = Vec::with_capacity(len);
    let mut opens = Vec::with_capacity(len);
    let mut highs = Vec::with_capacity(len);
    let mut lows = Vec::with_capacity(len);
    let mut closes = Vec::with_capacity(len);
    let mut volumes = Vec::with_capacity(len);
    let mut vwaps = Vec::with_capacity(len);
    let mut counts = Vec::with_capacity(len);

    for row in batch.drain(..) {
        symbols.push(row.symbol);
        ts.push(row.t);
        opens.push(row.o);
        highs.push(row.h);
        lows.push(row.l);
        closes.push(row.c);
        volumes.push(row.v);
        vwaps.push(row.vw);
        counts.push(row.n);
    }

    sqlx::query!(
        r#"
        INSERT INTO api.asset_prices (symbol, tstamp, open, high, low, close, volume, vwap, trade_count)
        SELECT * FROM UNNEST(
            $1::text[],
            $2::timestamptz[],
            $3::float8[],
            $4::float8[],
            $5::float8[],
            $6::float8[],
            $7::float8[],
            $8::float8[],
            $9::bigint[]
        )
        ON CONFLICT (symbol, tstamp) DO UPDATE SET
            open        = EXCLUDED.open,
            high        = EXCLUDED.high,
            low         = EXCLUDED.low,
            close       = EXCLUDED.close,
            volume      = EXCLUDED.volume,
            vwap        = EXCLUDED.vwap,
            trade_count = EXCLUDED.trade_count
        "#,
        &symbols,
        &ts as &[time::OffsetDateTime],
        &opens,
        &highs,
        &lows,
        &closes,
        &volumes,
        &vwaps,
        &counts,
    )
    .execute(pool)
    .await?;

    println!("Inserted {len} rows");
    Ok(())
}
