//! Shared domain logic for Notedash.
//!
//! This crate is designed to compile for native targets and `wasm32`.
//! The exported helpers focus on deterministic data normalization so the
//! frontend and desktop runtimes share one behavior model.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Defines the normalized service monitor state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MonitorState {
    /// Service is healthy and responding.
    Up,
    /// Service is partially degraded but still reachable.
    Degraded,
    /// Service is down or unreachable.
    Down,
}

/// Represents a service monitor row displayed in dashboard widgets.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DashboardMonitor {
    /// Stable identifier for the service monitor.
    pub id: String,
    /// Human-readable service name.
    pub name: String,
    /// Current normalized service state.
    pub state: MonitorState,
    /// Optional latest latency measurement in milliseconds.
    pub latency_ms: Option<u32>,
}

/// Represents a calendar event normalized from CalDAV or local sources.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DashboardEvent {
    /// Stable event identifier.
    pub id: String,
    /// Event title.
    pub title: String,
    /// Event start timestamp in ISO-8601 format.
    pub starts_at_iso: String,
    /// Event end timestamp in ISO-8601 format.
    pub ends_at_iso: String,
    /// Source label, such as `caldav`.
    pub source: String,
}

/// Sorts monitors by health state and then by name.
///
/// State priority is `Up`, `Degraded`, then `Down`.
/// Returns a JSON-compatible JS value for direct use in TypeScript.
#[wasm_bindgen]
pub fn normalize_monitors(raw: JsValue) -> Result<JsValue, JsValue> {
    let mut monitors: Vec<DashboardMonitor> = serde_wasm_bindgen::from_value(raw)
        .map_err(|error| JsValue::from_str(&format!("failed to decode monitors: {error}")))?;

    monitors.sort_by(|left, right| {
        monitor_rank(&left.state)
            .cmp(&monitor_rank(&right.state))
            .then_with(|| left.name.cmp(&right.name))
    });

    serde_wasm_bindgen::to_value(&monitors)
        .map_err(|error| JsValue::from_str(&format!("failed to encode monitors: {error}")))
}

/// Sorts events by start time in ascending lexicographic ISO order.
///
/// The function assumes ISO-8601 timestamps, where lexicographic ordering
/// matches chronological ordering.
#[wasm_bindgen]
pub fn normalize_events(raw: JsValue) -> Result<JsValue, JsValue> {
    let mut events: Vec<DashboardEvent> = serde_wasm_bindgen::from_value(raw)
        .map_err(|error| JsValue::from_str(&format!("failed to decode events: {error}")))?;

    events.sort_by(|left, right| left.starts_at_iso.cmp(&right.starts_at_iso));

    serde_wasm_bindgen::to_value(&events)
        .map_err(|error| JsValue::from_str(&format!("failed to encode events: {error}")))
}

/// Returns ordering rank for monitor state sorting.
fn monitor_rank(state: &MonitorState) -> u8 {
    match state {
        MonitorState::Up => 0,
        MonitorState::Degraded => 1,
        MonitorState::Down => 2,
    }
}

#[cfg(test)]
mod tests {
    use super::{monitor_rank, MonitorState};

    /// Verifies monitor rank ordering remains stable.
    #[test]
    fn monitor_rank_order_is_stable() {
        assert!(monitor_rank(&MonitorState::Up) < monitor_rank(&MonitorState::Degraded));
        assert!(monitor_rank(&MonitorState::Degraded) < monitor_rank(&MonitorState::Down));
    }
}
