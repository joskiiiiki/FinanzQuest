use std::collections::HashMap;

mod params {
    #[derive(strum_macros::Display, strum_macros::EnumString, Copy, Clone, Debug)]
    #[strum(serialize_all = "lowercase")]
    pub enum Feed {
        Sip,
        Iex,
        Boats,
    }

    #[derive(Clone, Debug)]
    pub enum Currency {
        EUR,
        USD,
        Other(String),
    }

    impl std::fmt::Display for Currency {
        fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            match self {
                Currency::EUR => write!(f, "EUR"),
                Currency::USD => write!(f, "USD"),
                Currency::Other(s) => write!(f, "{}", s),
            }
        }
    }

    #[derive(strum_macros::Display, strum_macros::EnumString, Copy, Clone, Debug)]
    #[strum(serialize_all = "kebab-case")]
    pub enum Adjustment {
        Raw,
        Split,
        Dividend,
        SpinOff,
        All,
    }

    #[derive(strum_macros::Display, strum_macros::EnumString, Copy, Clone, Debug)]
    #[strum(serialize_all = "lowercase")]
    pub enum Sort {
        Asc,
        Desc,
    }

    #[derive(Copy, Clone, Debug)]
    pub enum Timeframe {
        Minutes(u8),
        Hours(u8),
        Day,
        Week,
        Months(u8),
    }

    impl std::fmt::Display for Timeframe {
        fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            match self {
                Timeframe::Minutes(n) => write!(f, "{}Min", n),
                Timeframe::Hours(n) => write!(f, "{}Hour", n),
                Timeframe::Day => write!(f, "1Day"),
                Timeframe::Week => write!(f, "1Week"),
                Timeframe::Months(n) => write!(f, "{}Month", n),
            }
        }
    }

    #[derive(Clone, Debug)]
    pub enum DateTime {
        Date(time::Date),
        DateTime(time::OffsetDateTime),
    }

    impl DateTime {
        pub fn to_string(&self) -> Result<String, time::error::Format> {
            match self {
                Self::DateTime(dt) => dt.format(&time::format_description::well_known::Rfc3339),
                Self::Date(d) => {
                    let f = time::format_description::parse("[year]-[month]-[day]")
                        .expect("invalid format");
                    d.format(&f)
                }
            }
        }
    }
}

fn format_date(d: &time::Date) -> Result<String, time::error::Format> {
    let f = time::format_description::parse("[year]-[month]-[day]").expect("invalid format");
    d.format(&f)
}

#[derive(Default)]
pub struct QueryParams {
    pub timeframe: Option<params::Timeframe>,
    pub start: Option<params::DateTime>,
    pub end: Option<params::DateTime>,
    pub asof: Option<time::Date>,
    pub feed: Option<params::Feed>,
    pub currency: Option<params::Currency>,
    pub adjustment: Option<params::Adjustment>,
    pub limit: Option<u16>,
    pub page_token: Option<String>,
    pub sort: Option<params::Sort>,
}

impl QueryParams {
    pub fn to_params_list(&self) -> Result<Vec<(String, String)>, Box<dyn std::error::Error>> {
        macro_rules! param {
            ($list:expr, $key:expr, $val:expr) => {
                $list.push(($key.to_string(), $val.to_string()))
            };
        }

        let mut list: Vec<(String, String)> = Vec::new();

        if let Some(tf) = &self.timeframe {
            param!(list, "timeframe", tf)
        }
        if let Some(start) = &self.start {
            param!(list, "start", start.to_string()?)
        }
        if let Some(end) = &self.end {
            param!(list, "end", end.to_string()?)
        }
        if let Some(asof) = &self.asof {
            param!(list, "asof", format_date(asof)?)
        }
        if let Some(feed) = &self.feed {
            param!(list, "feed", feed)
        }
        if let Some(currency) = &self.currency {
            param!(list, "currency", currency)
        }
        if let Some(adjustment) = &self.adjustment {
            param!(list, "adjustment", adjustment)
        }
        if let Some(limit) = &self.limit {
            param!(list, "limit", limit)
        }
        if let Some(token) = &self.page_token {
            param!(list, "page_token", token)
        }
        if let Some(sort) = &self.sort {
            param!(list, "sort", sort)
        }

        Ok(list)
    }
}

pub struct AlpacaRequest {
    pub symbols: Vec<String>,
    pub query: QueryParams,
}

impl AlpacaRequest {
    pub fn new(symbols: impl IntoIterator<Item = impl Into<String>>, query: QueryParams) -> Self {
        Self {
            symbols: symbols.into_iter().map(Into::into).collect(),
            query,
        }
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct Bar {
    pub t: String, // timestamp
    pub o: f64,    // open
    pub h: f64,    // high
    pub l: f64,    // low
    pub c: f64,    // close
    pub v: f64,    // volume
    pub vw: f64,   // vwap
    pub n: u64,    // trade count
}

#[derive(Debug, serde::Deserialize)]
pub struct BarsResponse {
    pub bars: HashMap<String, Vec<Bar>>, // symbol -> bars
    pub next_page_token: Option<String>,
}

pub struct AlpacaClient {
    client: reqwest::Client,
    api_key_id: String,
    api_secret_key: String,
}

impl AlpacaClient {
    const URL: &'static str = "https://data.alpaca.markets/v2/stocks/bars";

    pub fn new(api_key_id: impl Into<String>, api_secret_key: impl Into<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key_id: api_key_id.into(),
            api_secret_key: api_secret_key.into(),
        }
    }

    pub async fn fetch_bars(
        &self,
        request: AlpacaRequest,
    ) -> Result<BarsResponse, Box<dyn std::error::Error>> {
        let mut params = request.query.to_params_list()?;
        params.push(("symbols".into(), request.symbols.join(",")));

        let response = self
            .client
            .get(Self::URL)
            .header("APCA-API-KEY-ID", &self.api_key_id)
            .header("APCA-API-SECRET-KEY", &self.api_secret_key)
            .query(&params)
            .send()
            .await?
            .error_for_status()?
            .json::<BarsResponse>()
            .await?;

        Ok(response)
    }

    /// Fetches all pages automatically, returns bars grouped by symbol
    pub async fn fetch_all_bars(
        &self,
        symbols: Vec<String>,
        mut query: QueryParams,
    ) -> Result<HashMap<String, Vec<Bar>>, Box<dyn std::error::Error>> {
        let mut all_bars: HashMap<String, Vec<Bar>> = HashMap::new();

        loop {
            let request = AlpacaRequest {
                symbols: symbols.clone(),
                query: QueryParams {
                    timeframe: query.timeframe,
                    start: query.start.clone(),
                    end: query.end.clone(),
                    asof: query.asof,
                    feed: query.feed,
                    currency: query.currency.clone(),
                    adjustment: query.adjustment,
                    limit: query.limit.or(Some(10000)),
                    page_token: query.page_token.clone(),
                    sort: query.sort,
                },
            };

            let response = self.fetch_bars(request).await?;

            for (symbol, bars) in response.bars {
                all_bars.entry(symbol).or_default().extend(bars);
            }

            match response.next_page_token {
                Some(token) => query.page_token = Some(token),
                None => break,
            }
        }

        Ok(all_bars)
    }

    pub fn stream_bars(
        &self,
        symbols: Vec<String>,
        mut query: QueryParams,
    ) -> impl tokio_stream::Stream<
        Item = Result<HashMap<String, Vec<Bar>>, Box<dyn std::error::Error>>,
    > + '_ {
        async_stream::stream! {
            loop {
                let request = AlpacaRequest {
                    symbols: symbols.clone(),
                    query: QueryParams {
                        limit: query.limit.or(Some(10000)),
                        page_token: query.page_token.clone(),
                        timeframe:  query.timeframe,
                        start:      query.start.clone(),
                        end:        query.end.clone(),
                        asof:       query.asof,
                        feed:       query.feed,
                        currency:   query.currency.clone(),
                        adjustment: query.adjustment,
                        sort:       query.sort,
                    },
                };

                match self.fetch_bars(request).await {
                    Err(e) => { yield Err(e); break; }
                    Ok(response) => {
                        let next = response.next_page_token.clone();
                        yield Ok(response.bars);

                        match next {
                            Some(token) => query.page_token = Some(token),
                            None => break,
                        }
                    }
                }
            }
        }
    }
}
