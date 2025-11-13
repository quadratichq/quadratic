//! Google Analytics Reports
//!
//! This module contains the reports for Google Analytics.
//! A report is just a pre-configured dimension and metric combination.
//! In datafusion, each report is a table.

use std::{collections::HashMap, sync::LazyLock};

#[derive(Debug, Clone)]
pub struct Report<'a> {
    pub name: &'a str,
    pub dimensions: Vec<&'a str>,
    pub metrics: Vec<&'a str>,
}

pub static REPORTS: LazyLock<HashMap<&str, Report<'static>>> = LazyLock::new(|| {
    HashMap::from([
        // Daily Active Users report
        (
            "daily_active_users",
            Report {
                name: "Daily Active Users",
                dimensions: vec!["date"],
                metrics: vec!["active1DayUsers"],
            },
        ),
        // Devices report
        (
            "devices",
            Report {
                name: "Devices",
                dimensions: vec![
                    "date",
                    "deviceCategory",
                    "deviceModel",
                    "operatingSystem",
                    "browser",
                ],
                metrics: vec![
                    "activeUsers",
                    "newUsers",
                    "sessions",
                    "sessionsPerUser",
                    "averageSessionDuration",
                    "screenPageViews",
                    "screenPageViewsPerSession",
                    "bounceRate",
                    "engagementRate",
                ],
            },
        ),
        // Four Weekly Active Users report
        (
            "four_weekly_active_users",
            Report {
                name: "Four Weekly Active Users",
                dimensions: vec!["date"],
                metrics: vec!["active28DayUsers"],
            },
        ),
        // Locations report
        (
            "locations",
            Report {
                name: "Locations",
                dimensions: vec!["date", "country", "countryId", "region", "city", "cityId"],
                metrics: vec![
                    "activeUsers",
                    "newUsers",
                    "sessions",
                    "sessionsPerUser",
                    "averageSessionDuration",
                    "screenPageViews",
                    "screenPageViewsPerSession",
                    "bounceRate",
                    "engagementRate",
                ],
            },
        ),
        // Pages report
        (
            "pages",
            Report {
                name: "Pages",
                dimensions: vec![
                    "date",
                    "hostName",
                    "pagePath",
                    "sessionMedium",
                    "sessionSource",
                ],
                metrics: vec![
                    "activeUsers",
                    "bounceRate",
                    "engagedSessions",
                    "engagementRate",
                    "eventCount",
                    "screenPageViews",
                    "screenPageViewsPerUser",
                    "screenPageViewsPerSession",
                    "userEngagementDuration",
                ],
            },
        ),
        // Traffic Sources report
        (
            "traffic_sources",
            Report {
                name: "Traffic Sources",
                dimensions: vec!["date", "source", "medium", "sourcePlatform"],
                metrics: vec![
                    "activeUsers",
                    "sessions",
                    "sessionsPerUser",
                    "bounceRate",
                    "engagementRate",
                ],
            },
        ),
        // Transactions report
        (
            "transactions",
            Report {
                name: "Transactions",
                dimensions: vec!["date"],
                metrics: vec![
                    "activeUsers",
                    "averageRevenuePerUser",
                    "newUsers",
                    "purchaseRevenue",
                    "sessions",
                    "totalRevenue",
                    "transactions",
                ],
            },
        ),
        // Weekly Active Users report
        (
            "weekly_active_users",
            Report {
                name: "Weekly Active Users",
                dimensions: vec!["date"],
                metrics: vec!["active7DayUsers"],
            },
        ),
        // Website Overview report
        (
            "website_overview",
            Report {
                name: "Website Overview",
                dimensions: vec!["date"],
                metrics: vec![
                    "activeUsers",
                    "newUsers",
                    "sessions",
                    "sessionsPerUser",
                    "averageSessionDuration",
                    "screenPageViews",
                    "screenPageViewsPerSession",
                    "bounceRate",
                    "engagementRate",
                ],
            },
        ),
    ])
});
