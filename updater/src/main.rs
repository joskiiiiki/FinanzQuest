use clap::Parser;
use std::{pin::pin, time::Duration};
use time::macros::date;
use tokio_stream::StreamExt;

mod alpaca;
mod priceframe;
use alpaca::AlpacaClient;

mod yf;

use crate::{
    alpaca::Feed,
    uploader::{Asset, Uploader, symbol_list},
};
mod uploader;

#[derive(clap::Parser, Debug)]
struct Args {
    #[arg(short, long)]
    db_url: String,

    #[arg(short, long, default_value_t = 1_000)]
    yf_timeout: usize,
    #[arg(short, long, default_value_t = 1_000)]
    al_timeout: usize,
    #[arg(short, long)]
    secret_key: String,
    #[arg(short, long)]
    key_id: String,
    #[arg(long, default_value_t = 10_000)]
    batch_size: usize,
    #[arg(long, default_value_t = 10)]
    fetch_chunk_size: usize,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let Args {
        db_url,
        secret_key,
        key_id,
        yf_timeout,
        al_timeout,
        batch_size,
        fetch_chunk_size,
    } = Args::parse();

    let yf_timeout = Duration::from_millis(yf_timeout as u64);
    let al_timeout = Duration::from_millis(al_timeout as u64);

    let client = AlpacaClient::new(key_id, secret_key);

    print!("Establishing database connection: ");

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(4)
        .connect(db_url.as_str())
        .await?;

    println!("DONE");

    print!("Fetching assets from database: ");
    let (yf_assets, al_assets) = uploader::fetch_assets(&pool)
        .await?
        .into_iter()
        .partition::<Vec<Asset>, _>(|asset| asset.is_yfinance());
    println!("DONE");

    let al_symbols = symbol_list(&al_assets);
    let yf_requests = yf_assets.into_iter().map(Into::into).collect();
    let uploader = Uploader::new(pool, batch_size).await?;

    print!("Fetching price data from alpaca: ");
    let mut stream = pin!(client.stream_bars_chunked(
        al_symbols,
        alpaca::QueryParams {
            timeframe: alpaca::Timeframe::Day,
            asof: Some(time::OffsetDateTime::now_utc().date()),
            start: Some(alpaca::DateTime::Date(date!(2020 - 01 - 01))),
            currency: Some(alpaca::Currency::EUR),
            adjustment: Some(alpaca::Adjustment::All),
            feed: Some(Feed::Iex),
            ..Default::default()
        },
        fetch_chunk_size
    ));

    while let Some(page) = stream.next().await {
        match page {
            Err(e) => {
                eprintln!("{e}");
                continue;
            }
            Ok(bars) => {
                let symbols: Vec<String> = bars.keys().cloned().collect();
                println!("Fetched data for {:?}.", symbols.join(","));
                uploader.send_bars(bars).await;
            }
        };
        tokio::time::sleep(al_timeout).await;
    }

    println!("DONE");
    let mut stream = pin!(yf::stream_prices(
        yf_requests,
        yf::FetchConfig {
            ..Default::default()
        }
    ));
    while let Some(page) = stream.next().await {
        match page.data {
            Err(e) => {
                eprintln!("{e}");
                continue;
            }
            Ok(bars) => uploader.send_frame(bars).await,
        };
        tokio::time::sleep(yf_timeout).await;
    }

    Ok(())
}
