use clap::Parser;
use std::{pin::pin, time::Duration};
use time::macros::date;
use tokio_stream::StreamExt;

mod alpaca;
use alpaca::AlpacaClient;
mod uploader;

#[derive(clap::Parser, Debug)]
struct Args {
    #[arg(short, long)]
    db_url: String,

    #[arg(short, long, default_value_t = 1000)]
    timeout: u32,
    #[arg(short, long)]
    secret_key: String,
    #[arg(short, long)]
    key_id: String,
}

#[tokio::main]
async fn main() {
    let Args {
        db_url,
        secret_key,
        key_id,
        timeout,
    } = Args::parse();

    let timeout = Duration::from_millis(timeout.into());

    let client = AlpacaClient::new(key_id, secret_key);

    let mut stream = pin!(client.stream_bars(
        vec!["AAPL".into(), "TSLA".into()],
        alpaca::QueryParams {
            timeframe: alpaca::Timeframe::Day,
            // asof: Some(time::OffsetDateTime::now_utc().date()),
            start: Some(alpaca::DateTime::Date(date!(2024 - 01 - 01))),
            ..Default::default()
        },
    ));
    while let Some(page) = stream.next().await {
        let res = match page {
            Err(e) => {
                eprintln!("{e}");
                continue;
            }
            Ok(p) => p,
        };

        println!("{res:#?}")
    }
}
