//! Google Analytics Reports
//!
//! This module contains the reports for Google Analytics.
//! A report is just a pre-configured dimension and metric combination.
//! In datafusion, each report is a table.

use std::{collections::HashMap, sync::LazyLock};

use crate::synced::SyncedConnectionTableKind;

#[derive(Debug, Clone)]
pub struct Report<'a> {
    pub name: &'a str,
    pub kind: SyncedConnectionTableKind,
    pub dimensions: Vec<&'a str>,
    pub metrics: Vec<&'a str>,
}

pub static REPORTS: LazyLock<HashMap<&str, Report<'static>>> = LazyLock::new(|| {
    HashMap::from([
        // Audiences report
        (
            "audiences",
            Report {
                name: "Audiences",
                kind: SyncedConnectionTableKind::TimeSeries,
                dimensions: vec!["audienceName"],
                metrics: vec![
                    "averageSessionDuration",
                    "newUsers",
                    "screenPageViewsPerSession",
                    "sessions",
                    "totalRevenue",
                    "totalUsers",
                ],
            },
        ),
        // Daily Active Users report
        (
            "daily_active_users",
            Report {
                name: "Daily Active Users",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec!["date"],
                metrics: vec!["active1DayUsers"],
            },
        ),
        // Demographic Details report
        (
            "demographic_details",
            Report {
                name: "Demographic Details",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec![
                    "brandingInterest",
                    "city",
                    "country",
                    "language",
                    "region",
                    "userAgeBracket",
                    "userGender",
                ],
                metrics: vec![
                    "activeUsers",
                    "engagedSessions",
                    "engagementRate",
                    "eventCount",
                    "keyEvents",
                    "newUsers",
                    "totalRevenue",
                    "userEngagementDuration",
                    "userKeyEventRate",
                ],
            },
        ),
        // Devices report
        (
            "devices",
            Report {
                name: "Devices",
                kind: SyncedConnectionTableKind::SingleTable,
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
        // Ecommerce Purchases report
        (
            "ecommerce_purchases",
            Report {
                name: "Ecommerce Purchases",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec![
                    "itemBrand",
                    "itemCategory",
                    "itemCategory2",
                    "itemCategory3",
                    // "itemCategory4",
                    // "itemCategory5",
                    "itemId",
                    "itemListPosition",
                    "itemName",
                    "itemVariant",
                ],
                metrics: vec![
                    "itemRevenue",
                    "itemsAddedToCart",
                    "itemsPurchased",
                    "itemsViewed",
                ],
            },
        ),
        // Events report
        (
            "events",
            Report {
                name: "Events",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec!["eventName"],
                metrics: vec![
                    "eventCount",
                    "eventCountPerUser",
                    "totalRevenue",
                    "totalUsers",
                ],
            },
        ),
        // Four Weekly Active Users report
        (
            "four_weekly_active_users",
            Report {
                name: "Four Weekly Active Users",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec!["date"],
                metrics: vec!["active28DayUsers"],
            },
        ),
        // Landing Page report
        (
            "landing_page",
            Report {
                name: "Landing Page",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec!["landingPage"],
                metrics: vec![
                    "activeUsers",
                    "keyEvents",
                    "newUsers",
                    "sessionKeyEventRate",
                    "sessions",
                    "totalRevenue",
                    "userEngagementDuration",
                ],
            },
        ),
        // Locations report
        (
            "locations",
            Report {
                kind: SyncedConnectionTableKind::SingleTable,
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
                kind: SyncedConnectionTableKind::SingleTable,
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
        // Pages and Screens report
        (
            "pages_and_screens",
            Report {
                kind: SyncedConnectionTableKind::SingleTable,
                name: "Pages and Screens",
                dimensions: vec![
                    "contentGroup",
                    "unifiedPagePathScreen",
                    "unifiedScreenClass",
                    "unifiedScreenName",
                ],
                metrics: vec![
                    "activeUsers",
                    "eventCount",
                    "keyEvents",
                    "screenPageViews",
                    "screenPageViewsPerUser",
                    "totalRevenue",
                    "userEngagementDuration",
                ],
            },
        ),
        // Promotions report
        (
            "promotions",
            Report {
                name: "Promotions",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec![
                    "itemListPosition",
                    "itemPromotionCreativeName",
                    "itemPromotionId",
                    "itemPromotionName",
                ],
                metrics: vec![
                    "itemPromotionClickThroughRate",
                    "itemRevenue",
                    "itemsAddedToCart",
                    "itemsCheckedOut",
                    "itemsClickedInPromotion",
                    "itemsPurchased",
                    "itemsViewedInPromotion",
                ],
            },
        ),
        // Tech Details report
        (
            "tech_details",
            Report {
                name: "Tech Details",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec![
                    "appVersion",
                    "browser",
                    "deviceCategory",
                    "operatingSystem",
                    "operatingSystemVersion",
                    // "operatingSystemWithVersion",
                    "platform",
                    "platformDeviceCategory",
                    "screenResolution",
                ],
                metrics: vec![
                    "activeUsers",
                    "engagedSessions",
                    "engagementRate",
                    "eventCount",
                    "keyEvents",
                    "newUsers",
                    "totalRevenue",
                    "userEngagementDuration",
                ],
            },
        ),
        // Traffic Acquisition report
        (
            "traffic_acquisition",
            Report {
                kind: SyncedConnectionTableKind::TimeSeries,
                name: "Traffic Acquisition",
                dimensions: vec![
                    "sessionCampaignName",
                    "sessionDefaultChannelGroup",
                    "sessionMedium",
                    "sessionPrimaryChannelGroup",
                    "sessionSource",
                    "sessionSourceMedium",
                    "sessionSourcePlatform",
                ],
                metrics: vec![
                    "engagedSessions",
                    "engagementRate",
                    "eventCount",
                    "eventsPerSession",
                    "keyEvents",
                    "sessionKeyEventRate",
                    "sessions",
                    "totalRevenue",
                    "userEngagementDuration",
                ],
            },
        ),
        // Traffic Sources report
        (
            "traffic_sources",
            Report {
                name: "Traffic Sources",
                kind: SyncedConnectionTableKind::TimeSeries,
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
                kind: SyncedConnectionTableKind::TimeSeries,
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
        // User Acquisition report
        (
            "user_acquisition",
            Report {
                name: "User Acquisition",
                kind: SyncedConnectionTableKind::TimeSeries,
                dimensions: vec![
                    "firstUserCampaignName",
                    "firstUserDefaultChannelGroup",
                    "firstUserMedium",
                    "firstUserPrimaryChannelGroup",
                    "firstUserSource",
                    "firstUserSourceMedium",
                    "firstUserSourcePlatform",
                ],
                metrics: vec![
                    "activeUsers",
                    "engagedSessions",
                    "eventCount",
                    "keyEvents",
                    "newUsers",
                    "totalRevenue",
                    "totalUsers",
                    "userEngagementDuration",
                    "userKeyEventRate",
                ],
            },
        ),
        // Weekly Active Users report
        (
            "weekly_active_users",
            Report {
                name: "Weekly Active Users",
                kind: SyncedConnectionTableKind::SingleTable,
                dimensions: vec!["date"],
                metrics: vec!["active7DayUsers"],
            },
        ),
        // Website Overview report
        (
            "website_overview",
            Report {
                name: "Website Overview",
                kind: SyncedConnectionTableKind::TimeSeries,
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
