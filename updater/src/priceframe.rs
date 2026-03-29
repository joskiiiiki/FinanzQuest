use std::collections::HashMap;

use serde::Serialize;

use crate::alpaca;

fn offset_dt_from_string(s: String) -> Result<time::OffsetDateTime, time::error::Parse> {
    time::OffsetDateTime::parse(&s, &time::format_description::well_known::Rfc3339)
}

impl From<HashMap<String, Vec<alpaca::Bar>>> for PriceFrame {
    fn from(mut value: HashMap<String, Vec<alpaca::Bar>>) -> Self {
        let len = value.values().fold(0, |len, bars| len + bars.len());
        let mut frame = Self::with_capacity(len);

        for (symbol, mut rows) in value.drain() {
            for row in rows.drain(..) {
                let Ok(t) = offset_dt_from_string(row.t) else {
                    continue;
                };
                frame.push_row(symbol.clone(), row.o, row.c, row.h, row.l, row.v, t)
            }
        }

        frame
    }
}

#[derive(Debug, Serialize, Default)]
pub struct PriceFrame {
    pub symbol: Vec<String>,
    pub open: Vec<f64>,
    pub close: Vec<f64>,
    pub high: Vec<f64>,
    pub low: Vec<f64>,
    pub volume: Vec<i64>,
    pub tstamp: Vec<time::OffsetDateTime>,
    pub length: usize,
}

impl PriceFrame {
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            symbol: Vec::with_capacity(capacity),
            open: Vec::with_capacity(capacity),
            close: Vec::with_capacity(capacity),
            high: Vec::with_capacity(capacity),
            low: Vec::with_capacity(capacity),
            volume: Vec::with_capacity(capacity),
            tstamp: Vec::with_capacity(capacity),
            length: 0,
        }
    }
    pub fn extend(&mut self, v: &mut Self) {
        self.symbol.append(&mut v.symbol);
        self.open.append(&mut v.open);
        self.close.append(&mut v.close);
        self.high.append(&mut v.high);
        self.low.append(&mut v.low);
        self.volume.append(&mut v.volume);
        self.tstamp.append(&mut v.tstamp);
        self.length += v.length;
    }
    pub fn push_row(
        &mut self,
        symbol: String,
        open: f64,
        close: f64,
        high: f64,
        low: f64,
        volume: i64,
        tstamp: time::OffsetDateTime,
    ) {
        self.tstamp.push(tstamp);
        self.symbol.push(symbol);
        self.open.push(open);
        self.close.push(close);
        self.high.push(high);
        self.low.push(low);
        self.volume.push(volume);
        self.length += 1
    }

    pub fn len(&self) -> usize {
        self.length
    }

    pub fn is_empty(&self) -> bool {
        self.length == 0
    }

    pub fn clear(&mut self) {
        self.symbol.clear();
        self.open.clear();
        self.close.clear();
        self.high.clear();
        self.low.clear();
        self.volume.clear();
        self.tstamp.clear();
        self.length = 0;
    }
}
