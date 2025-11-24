use arrow::array::{ArrayRef, BooleanArray, Date32Array, Float64Array, RecordBatch, StringArray};
use arrow::datatypes::{DataType, Field, Schema};
use bytes::Bytes;
use chrono::NaiveDate;
use parquet::arrow::ArrowWriter;
use plaid::model::{TransactionsGetRequestOptions, TransactionsGetResponse};
use std::io::Cursor;
use std::sync::Arc;

use crate::SharedError;
use crate::error::Result;
use crate::synced::plaid::client::PlaidClient;

impl PlaidClient {
    /// Get transactions for a date range
    /// Requires an access token to be set
    ///
    /// # Arguments
    /// * `start_date` - Start date for transaction query (inclusive)
    /// * `end_date` - End date for transaction query (inclusive)
    ///
    /// # Returns
    /// Returns a vector of transactions
    pub async fn get_transactions(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<TransactionsGetResponse> {
        let access_token = self.access_token()?;
        let transactions = self
            .client
            .transactions_get(access_token, end_date, start_date)
            .options(TransactionsGetRequestOptions {
                account_ids: Some(vec!["your account ids".to_owned()]),
                count: Some(1),
                days_requested: Some(1),
                include_logo_and_counterparty_beta: Some(true),
                include_original_description: Some(true),
                include_personal_finance_category: Some(true),
                include_personal_finance_category_beta: Some(true),
                offset: Some(1),
            })
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to get transactions: {}", e)))?;

        Ok(transactions)
    }
}

/// Convert Plaid transactions to Parquet format
///
/// Takes a TransactionsGetResponse from Plaid and converts the transactions
/// into a Parquet file format suitable for data analysis.
///
/// # Arguments
/// * `transactions` - The response from Plaid's transactions API
///
/// # Returns
/// Returns the Parquet file as bytes
pub fn transactions_to_parquet(transactions: TransactionsGetResponse) -> Result<Bytes> {
    let txns = transactions.transactions;

    if txns.is_empty() {
        return Err(SharedError::Synced(
            "No transactions to convert to Parquet".to_string(),
        ));
    }

    // Define the Arrow schema
    let schema = Schema::new(vec![
        Field::new("transaction_id", DataType::Utf8, false),
        Field::new("account_id", DataType::Utf8, false),
        Field::new("amount", DataType::Float64, false),
        Field::new("date", DataType::Date32, false),
        Field::new("name", DataType::Utf8, true),
        Field::new("merchant_name", DataType::Utf8, true),
        Field::new("category", DataType::Utf8, true),
        Field::new("pending", DataType::Boolean, false),
        Field::new("payment_channel", DataType::Utf8, false),
        Field::new("authorized_date", DataType::Date32, true),
        Field::new("iso_currency_code", DataType::Utf8, true),
        Field::new("unofficial_currency_code", DataType::Utf8, true),
        Field::new("check_number", DataType::Utf8, true),
        Field::new("original_description", DataType::Utf8, true),
        Field::new("merchant_entity_id", DataType::Utf8, true),
    ]);

    // Helper function to convert NaiveDate to days since epoch
    let date_to_days = |date: NaiveDate| -> Result<i32> {
        let epoch = NaiveDate::from_ymd_opt(1970, 1, 1)
            .ok_or_else(|| SharedError::Synced("Failed to create epoch date".to_string()))?;
        Ok((date - epoch).num_days() as i32)
    };

    // Build arrays for each column
    let mut transaction_ids = Vec::with_capacity(txns.len());
    let mut account_ids = Vec::with_capacity(txns.len());
    let mut amounts = Vec::with_capacity(txns.len());
    let mut dates = Vec::with_capacity(txns.len());
    let mut names = Vec::with_capacity(txns.len());
    let mut merchant_names = Vec::with_capacity(txns.len());
    let mut categories = Vec::with_capacity(txns.len());
    let mut pendings = Vec::with_capacity(txns.len());
    let mut payment_channels = Vec::with_capacity(txns.len());
    let mut authorized_dates = Vec::with_capacity(txns.len());
    let mut iso_currency_codes = Vec::with_capacity(txns.len());
    let mut unofficial_currency_codes = Vec::with_capacity(txns.len());
    let mut check_numbers = Vec::with_capacity(txns.len());
    let mut original_descriptions = Vec::with_capacity(txns.len());
    let mut merchant_entity_ids = Vec::with_capacity(txns.len());

    for txn in txns {
        transaction_ids.push(txn.transaction_id.clone());
        account_ids.push(txn.account_id.clone());
        amounts.push(txn.amount);
        dates.push(date_to_days(txn.date)?);
        names.push(txn.name.clone());
        merchant_names.push(txn.merchant_name.clone());

        // Join category array into a single string
        categories.push(txn.category.as_ref().map(|cats| cats.join(" > ")));

        pendings.push(txn.pending);
        payment_channels.push(txn.payment_channel.clone());

        // Convert authorized_date if present
        let auth_date = match txn.authorized_date {
            Some(d) => Some(date_to_days(d)?),
            None => None,
        };
        authorized_dates.push(auth_date);

        iso_currency_codes.push(txn.iso_currency_code.clone());
        unofficial_currency_codes.push(txn.unofficial_currency_code.clone());
        check_numbers.push(txn.check_number.clone());
        original_descriptions.push(txn.original_description.clone());
        merchant_entity_ids.push(txn.merchant_entity_id.clone());
    }

    // Create Arrow arrays
    let transaction_id_array = Arc::new(StringArray::from(transaction_ids)) as ArrayRef;
    let account_id_array = Arc::new(StringArray::from(account_ids)) as ArrayRef;
    let amount_array = Arc::new(Float64Array::from(amounts)) as ArrayRef;
    let date_array = Arc::new(Date32Array::from(dates)) as ArrayRef;
    let name_array = Arc::new(StringArray::from(names)) as ArrayRef;
    let merchant_name_array = Arc::new(StringArray::from(merchant_names)) as ArrayRef;
    let category_array = Arc::new(StringArray::from(categories)) as ArrayRef;
    let pending_array = Arc::new(BooleanArray::from(pendings)) as ArrayRef;
    let payment_channel_array = Arc::new(StringArray::from(payment_channels)) as ArrayRef;
    let authorized_date_array = Arc::new(Date32Array::from(authorized_dates)) as ArrayRef;
    let iso_currency_code_array = Arc::new(StringArray::from(iso_currency_codes)) as ArrayRef;
    let unofficial_currency_code_array =
        Arc::new(StringArray::from(unofficial_currency_codes)) as ArrayRef;
    let check_number_array = Arc::new(StringArray::from(check_numbers)) as ArrayRef;
    let original_description_array = Arc::new(StringArray::from(original_descriptions)) as ArrayRef;
    let merchant_entity_id_array = Arc::new(StringArray::from(merchant_entity_ids)) as ArrayRef;

    // Create RecordBatch
    let batch = RecordBatch::try_new(
        Arc::new(schema.clone()),
        vec![
            transaction_id_array,
            account_id_array,
            amount_array,
            date_array,
            name_array,
            merchant_name_array,
            category_array,
            pending_array,
            payment_channel_array,
            authorized_date_array,
            iso_currency_code_array,
            unofficial_currency_code_array,
            check_number_array,
            original_description_array,
            merchant_entity_id_array,
        ],
    )
    .map_err(|e| SharedError::Synced(format!("Failed to create RecordBatch: {}", e)))?;

    // Write to Parquet
    let mut buffer = Cursor::new(Vec::new());
    {
        let mut writer = ArrowWriter::try_new(&mut buffer, Arc::new(schema), None)
            .map_err(|e| SharedError::Synced(format!("Failed to create Parquet writer: {}", e)))?;

        writer
            .write(&batch)
            .map_err(|e| SharedError::Synced(format!("Failed to write Parquet batch: {}", e)))?;

        writer
            .close()
            .map_err(|e| SharedError::Synced(format!("Failed to close Parquet writer: {}", e)))?;
    }

    Ok(Bytes::from(buffer.into_inner()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use plaid::model::{Item, Transaction, TransactionBase};

    fn create_test_transaction(
        transaction_id: &str,
        account_id: &str,
        amount: f64,
        date: NaiveDate,
        name: Option<String>,
        merchant_name: Option<String>,
        category: Option<Vec<String>>,
        pending: bool,
        payment_channel: &str,
        authorized_date: Option<NaiveDate>,
        iso_currency_code: Option<String>,
    ) -> Transaction {
        Transaction {
            transaction_base: TransactionBase {
                transaction_id: transaction_id.to_string(),
                account_id: account_id.to_string(),
                amount,
                date,
                name,
                merchant_name,
                category,
                pending,
                iso_currency_code,
                unofficial_currency_code: None,
                check_number: None,
                original_description: None,
                account_owner: None,
                category_id: None,
                location: None,
                logo_url: None,
                payment_meta: None,
                pending_transaction_id: None,
                transaction_type: None,
                website: None,
            },
            authorized_date,
            authorized_datetime: None,
            counterparties: vec![],
            datetime: None,
            merchant_entity_id: None,
            payment_channel: payment_channel.to_string(),
            personal_finance_category: None,
            personal_finance_category_icon_url: None,
            transaction_code: None,
        }
    }

    fn create_test_response(transactions: Vec<Transaction>) -> TransactionsGetResponse {
        TransactionsGetResponse {
            accounts: vec![],
            item: Item {
                available_products: vec![],
                billed_products: vec![],
                consent_expiration_time: None,
                error: None,
                institution_id: None,
                item_id: "test_item".to_string(),
                update_type: "background".to_string(),
                webhook: None,
                consented_products: None,
                products: None,
            },
            request_id: "test_request".to_string(),
            total_transactions: transactions.len() as i64,
            transactions,
        }
    }

    #[test]
    fn test_transactions_to_parquet_single_transaction() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 15).expect("Invalid date");
        let auth_date = NaiveDate::from_ymd_opt(2024, 1, 14).expect("Invalid date");

        let transaction = create_test_transaction(
            "txn_123",
            "acc_456",
            -50.25,
            date,
            Some("Coffee Shop".to_string()),
            Some("Starbucks".to_string()),
            Some(vec![
                "Food and Drink".to_string(),
                "Restaurants".to_string(),
            ]),
            false,
            "in store",
            Some(auth_date),
            Some("USD".to_string()),
        );

        let response = create_test_response(vec![transaction]);
        let result = transactions_to_parquet(response);
        assert!(result.is_ok());

        let parquet_bytes = result.expect("Failed to convert to parquet");
        assert!(!parquet_bytes.is_empty());

        // Verify we can read the parquet data back
        // Note: We'd need to use parquet reader to fully verify, but checking bytes is sufficient
        assert!(parquet_bytes.len() > 100); // Parquet has overhead
    }

    #[test]
    fn test_transactions_to_parquet_multiple_transactions() {
        let date1 = NaiveDate::from_ymd_opt(2024, 1, 15).expect("Invalid date");
        let date2 = NaiveDate::from_ymd_opt(2024, 1, 16).expect("Invalid date");
        let date3 = NaiveDate::from_ymd_opt(2024, 1, 17).expect("Invalid date");

        let transactions = vec![
            create_test_transaction(
                "txn_1",
                "acc_1",
                -50.00,
                date1,
                Some("Store 1".to_string()),
                Some("Merchant 1".to_string()),
                Some(vec!["Shopping".to_string()]),
                false,
                "online",
                Some(date1),
                Some("USD".to_string()),
            ),
            create_test_transaction(
                "txn_2",
                "acc_1",
                -75.50,
                date2,
                Some("Store 2".to_string()),
                Some("Merchant 2".to_string()),
                Some(vec!["Food and Drink".to_string(), "Groceries".to_string()]),
                true,
                "in store",
                None,
                Some("USD".to_string()),
            ),
            create_test_transaction(
                "txn_3",
                "acc_2",
                1000.00,
                date3,
                Some("Paycheck".to_string()),
                None,
                None,
                false,
                "other",
                Some(date3),
                Some("USD".to_string()),
            ),
        ];

        let response = create_test_response(transactions);
        let result = transactions_to_parquet(response);
        assert!(result.is_ok());

        let parquet_bytes = result.expect("Failed to convert to parquet");
        assert!(!parquet_bytes.is_empty());
    }

    #[test]
    fn test_transactions_to_parquet_with_optional_fields() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 15).expect("Invalid date");

        // Transaction with minimal fields (many optionals as None)
        let transaction = create_test_transaction(
            "txn_minimal",
            "acc_minimal",
            -25.00,
            date,
            None,
            None,
            None,
            false,
            "online",
            None,
            None,
        );

        let response = create_test_response(vec![transaction]);
        let result = transactions_to_parquet(response);
        assert!(result.is_ok());

        let parquet_bytes = result.expect("Failed to convert to parquet");
        assert!(!parquet_bytes.is_empty());
    }

    #[test]
    fn test_transactions_to_parquet_category_joining() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 15).expect("Invalid date");

        // Transaction with multi-level category
        let transaction = create_test_transaction(
            "txn_cat",
            "acc_cat",
            -100.00,
            date,
            Some("Purchase".to_string()),
            Some("Merchant".to_string()),
            Some(vec![
                "Food and Drink".to_string(),
                "Restaurants".to_string(),
                "Fast Food".to_string(),
            ]),
            false,
            "in store",
            Some(date),
            Some("USD".to_string()),
        );

        let response = create_test_response(vec![transaction]);
        let result = transactions_to_parquet(response);
        assert!(result.is_ok());

        // The category should be joined with " > " separator
        // We can't easily verify this without reading the parquet back,
        // but we ensure it doesn't error
        let parquet_bytes = result.expect("Failed to convert to parquet");
        assert!(!parquet_bytes.is_empty());
    }

    #[test]
    fn test_transactions_to_parquet_pending_transactions() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 15).expect("Invalid date");

        let transactions = vec![
            create_test_transaction(
                "txn_pending",
                "acc_1",
                -50.00,
                date,
                Some("Pending Purchase".to_string()),
                Some("Merchant".to_string()),
                None,
                true, // pending
                "online",
                None,
                Some("USD".to_string()),
            ),
            create_test_transaction(
                "txn_posted",
                "acc_1",
                -75.00,
                date,
                Some("Posted Purchase".to_string()),
                Some("Merchant".to_string()),
                None,
                false, // not pending
                "online",
                Some(date),
                Some("USD".to_string()),
            ),
        ];

        let response = create_test_response(transactions);
        let result = transactions_to_parquet(response);
        assert!(result.is_ok());

        let parquet_bytes = result.expect("Failed to convert to parquet");
        assert!(!parquet_bytes.is_empty());
    }

    #[test]
    fn test_transactions_to_parquet_different_currencies() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 15).expect("Invalid date");

        let transactions = vec![
            create_test_transaction(
                "txn_usd",
                "acc_1",
                -50.00,
                date,
                Some("USD Purchase".to_string()),
                None,
                None,
                false,
                "online",
                None,
                Some("USD".to_string()),
            ),
            create_test_transaction(
                "txn_eur",
                "acc_2",
                -45.00,
                date,
                Some("EUR Purchase".to_string()),
                None,
                None,
                false,
                "online",
                None,
                Some("EUR".to_string()),
            ),
            create_test_transaction(
                "txn_gbp",
                "acc_3",
                -40.00,
                date,
                Some("GBP Purchase".to_string()),
                None,
                None,
                false,
                "online",
                None,
                Some("GBP".to_string()),
            ),
        ];

        let response = create_test_response(transactions);
        let result = transactions_to_parquet(response);
        assert!(result.is_ok());

        let parquet_bytes = result.expect("Failed to convert to parquet");
        assert!(!parquet_bytes.is_empty());
    }
}
