use async_stream::stream;
use rand::seq::IndexedRandom;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tokio::time::sleep;

use crate::{priceframe::PriceFrame, uploader::Asset};

const ROOT_URL: &str = "https://query2.finance.yahoo.com";
const USER_AGENTS: &[&str] = &[
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
];

pub fn client() -> Result<Client, reqwest::Error> {
    let ua = USER_AGENTS.choose(&mut rand::rng()).unwrap();
    reqwest::Client::builder()
        .user_agent(*ua)
        .timeout(Duration::from_secs(30))
        .build()
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Request error: {0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("Empty response")]
    EmptyResponse,
    #[error("Malformed Response: {error}\n {response}")]
    MalformedResponse {
        error: serde_json::Error,
        response: serde_json::Value,
    },
    #[error("Yahoo Finance error: {0}")]
    YFinanceError(Value),
    #[error("Rate limited")]
    RateLimited,
    #[error("Symbol not found: {0}")]
    NotFound(String),
    #[error("Format error: {0}")]
    Format(#[from] time::error::Format),
    #[error("Date error: {0}")]
    Date(#[from] time::error::Error),
}

impl Error {
    /// Should we retry this error?
    pub fn is_retryable(&self) -> bool {
        matches!(self, Error::RateLimited | Error::Reqwest(_))
    }

    /// Should we skip this symbol entirely?
    pub fn is_fatal(&self) -> bool {
        matches!(
            self,
            Error::NotFound(_)
                | Error::MalformedResponse {
                    error: _,
                    response: _
                }
        )
    }
}

#[derive(Debug)]
pub struct SymbolResult {
    pub symbol: String,
    pub asset_id: i64,
    pub data: Result<PriceFrame, Error>,
}

#[derive(Debug, Deserialize)]
struct Quote {
    open: Vec<Option<f64>>,
    close: Vec<Option<f64>>,
    high: Vec<Option<f64>>,
    low: Vec<Option<f64>>,
    volume: Vec<Option<i64>>,
}
#[derive(Debug, Deserialize)]
struct NonNullQuote {
    open: Vec<f64>,
    close: Vec<f64>,
    high: Vec<f64>,
    low: Vec<f64>,
    volume: Vec<i64>,
}

fn mk_url(
    symbol: &str,
    range: Option<&(time::OffsetDateTime, time::OffsetDateTime)>,
    interval: &str,
) -> String {
    match range {
        Some((start, end)) => format!(
            "{ROOT_URL}/v8/finance/chart/{symbol}?period1={}&period2={}&interval={interval}",
            start.unix_timestamp(),
            end.unix_timestamp()
        ),
        None => format!("{ROOT_URL}/v8/finance/chart/{symbol}?range=5y&interval={interval}"),
    }
}

#[inline]
fn uts_to_datetime(u: &i64) -> time::OffsetDateTime {
    time::OffsetDateTime::from_unix_timestamp(*u).unwrap()
}

fn filter_null_data(mut timestamps: Vec<i64>, mut quote: Quote) -> (Vec<i64>, NonNullQuote) {
    let valid_indices: Vec<usize> = quote
        .close
        .iter()
        .enumerate()
        .filter_map(|(i, c)| c.is_some().then_some(i))
        .collect();
    timestamps = valid_indices.iter().map(|&i| timestamps[i]).collect();
    let quote = NonNullQuote {
        open: valid_indices
            .iter()
            .map(|&i| quote.open[i].unwrap())
            .collect(),
        close: valid_indices
            .iter()
            .map(|&i| quote.close[i].unwrap())
            .collect(),
        high: valid_indices
            .iter()
            .map(|&i| quote.high[i].unwrap())
            .collect(),
        low: valid_indices
            .iter()
            .map(|&i| quote.low[i].unwrap())
            .collect(),
        volume: valid_indices
            .iter()
            .map(|&i| quote.volume[i].unwrap())
            .collect(),
    };
    (timestamps, quote)
}
async fn fetch_once(
    client: &Client,
    symbol: &str,
    range: Option<&(time::OffsetDateTime, time::OffsetDateTime)>,
) -> Result<PriceFrame, Error> {
    let url = mk_url(symbol, range, "1d");
    let mut response: Value = client.get(&url).send().await?.json().await?;

    // classify errors
    match response.pointer("/chart/error") {
        Some(Value::Object(e)) => {
            let code = e.get("code").and_then(|v| v.as_str()).unwrap_or("");
            return Err(
                if code == "Not Found" || code == "No fundamentals data found" {
                    Error::NotFound(symbol.to_string())
                } else if code == "Too Many Requests" {
                    Error::RateLimited
                } else {
                    Error::YFinanceError(Value::Object(e.clone()))
                },
            );
        }
        Some(v) if !v.is_null() => return Err(Error::YFinanceError(v.clone())),
        _ => {}
    }

    let mut result = response
        .pointer("/chart/result/0")
        .ok_or(Error::EmptyResponse)?
        .clone();

    let timestamps: Vec<i64> = serde_json::from_value(
        result
            .pointer_mut("/timestamp")
            .ok_or(Error::EmptyResponse)?
            .take(),
    )
    .map_err({
        let response = response.clone();
        |error| Error::MalformedResponse { error, response }
    })?;

    let quote: Quote = serde_json::from_value(
        result
            .pointer_mut("/indicators/quote/0")
            .ok_or(Error::EmptyResponse)?
            .take(),
    )
    .map_err({
        let response = response.clone();
        |error| Error::MalformedResponse { error, response }
    })?;

    let (timestamps, quote) = filter_null_data(timestamps, quote);

    let len = timestamps.len();
    Ok(PriceFrame {
        symbol: vec![symbol.into(); len],
        tstamp: timestamps.iter().map(uts_to_datetime).collect(),
        open: quote.open,
        close: quote.close,
        high: quote.high,
        low: quote.low,
        volume: quote.volume,
        length: len,
    })
}

const DEFAULT_END_DT: time::OffsetDateTime =
    time::OffsetDateTime::new_utc(time::Date::MAX, time::Time::MAX);
const DEFAULT_START_DT: time::OffsetDateTime = time::macros::datetime!(2020-01-01 00:00 UTC);

pub struct FetchRequest {
    pub asset_id: i64,
    pub symbol: String,
    pub range: Option<(time::OffsetDateTime, time::OffsetDateTime)>,
}

impl From<Asset> for FetchRequest {
    fn from(asset: Asset) -> Self {
        let start = match asset.last_updated {
            Some(start) => time::OffsetDateTime::new_utc(start, time::Time::MIDNIGHT),
            None => DEFAULT_START_DT,
        };
        Self {
            asset_id: asset.id,
            symbol: asset.symbol,
            range: Some((start, DEFAULT_END_DT)),
        }
    }
}

pub struct FetchConfig {
    /// Base delay between requests
    pub request_delay: Duration,
    /// Max jitter added to delay
    pub jitter: Duration,
    /// Max retries per symbol
    pub max_retries: u32,
    /// Base backoff for retries
    pub backoff_base: Duration,
}

impl Default for FetchConfig {
    fn default() -> Self {
        Self {
            request_delay: Duration::from_millis(500),
            jitter: Duration::from_millis(500),
            backoff_base: Duration::from_secs(2),
            max_retries: 4,
        }
    }
}

pub fn stream_prices(
    symbols: Vec<FetchRequest>,
    config: FetchConfig,
) -> impl tokio_stream::Stream<Item = SymbolResult> {
    stream! {
        for req in symbols {
            // always sleep between symbols to avoid rate limiting
            let jitter = Duration::from_millis(rand::random::<u64>() % config.jitter.as_millis() as u64);
            sleep(config.request_delay + jitter).await;

            let mut last_err = None;

            for attempt in 0..config.max_retries {
                // new client per attempt — fresh UA, fresh connection
                let client = match client() {
                    Ok(c) => c,
                    Err(e) => {
                        last_err = Some(Error::Reqwest(e));
                        break;
                    }
                };

                match fetch_once(&client, &req.symbol, req.range.as_ref()).await {
                    Ok(mut frame) => {
                        last_err = None;
                        yield SymbolResult {
                            symbol: req.symbol.clone(),
                            asset_id: req.asset_id,
                            data: Ok(frame),
                        };
                        break;
                    }
                    Err(e) if e.is_fatal() => {
                        // not retryable — skip immediately
                        yield SymbolResult {
                            symbol: req.symbol.clone(),
                            asset_id: req.asset_id,
                            data: Err(e),
                        };
                        break;
                    }
                    Err(e) => {
                        let backoff = config.backoff_base * 2u32.pow(attempt);
                        eprintln!("Attempt {}/{} failed for {}: {e} — backing off {}s",
                            attempt + 1, config.max_retries, req.symbol, backoff.as_secs());
                        sleep(backoff).await;
                        last_err = Some(e);
                    }
                }
            }

            if let Some(e) = last_err {
                yield SymbolResult {
                    symbol: req.symbol.clone(),
                    asset_id: req.asset_id,
                    data: Err(e),
                };
            }
        }
    }
}
