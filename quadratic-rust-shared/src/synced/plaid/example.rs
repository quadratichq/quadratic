/// Example usage of the Plaid client
/// 
/// This file demonstrates the complete flow for integrating Plaid:
/// 1. Creating a link token
/// 2. Exchanging a public token for an access token
/// 3. Fetching transactions
/// 
/// Note: This is example code and not meant to be compiled as part of the library.
/// It's provided for documentation and reference purposes.

#[allow(dead_code)]
mod example {
    use chrono::NaiveDate;
    use crate::synced::plaid::client::{PlaidClient, PlaidEnvironment};
    use crate::synced::plaid::PlaidConnection;
    use crate::synced::SyncedConnection;
    use crate::error::Result;

    /// Example: Initialize a Plaid client for sandbox testing
    pub async fn example_initialize_client() -> Result<PlaidClient> {
        // For sandbox testing
        let client = PlaidClient::new(
            "your_client_id",
            "your_secret",
            PlaidEnvironment::Sandbox,
        );

        Ok(client)
    }

    /// Example: Create a link token (Step 1 of Plaid Link flow)
    /// 
    /// This is called from your backend API endpoint.
    /// The link token is then sent to your frontend to initialize Plaid Link.
    pub async fn example_create_link_token(client: &PlaidClient) -> Result<String> {
        let link_token = client.create_link_token(
            "user_123",              // Your internal user ID
            "Quadratic"              // Your app name (shown in Plaid Link UI)
        ).await?;

        // In a real application, you would:
        // 1. Return this link_token to your frontend via API response
        // 2. Frontend uses it to initialize Plaid Link
        // 3. User authenticates and links their bank account
        // 4. Frontend receives a public_token
        // 5. Frontend sends public_token back to your backend

        Ok(link_token)
    }

    /// Example: Exchange public token for access token (Step 2 of Plaid Link flow)
    /// 
    /// This is called from your backend API endpoint after receiving
    /// the public_token from your frontend.
    pub async fn example_exchange_public_token(
        client: &mut PlaidClient,
        public_token: &str,
    ) -> Result<String> {
        let access_token = client.exchange_public_token(public_token).await?;

        // In a real application, you would:
        // 1. Store this access_token securely in your database (encrypted)
        // 2. Associate it with the user who linked their account
        // 3. Use it for all future API calls to fetch data for this user

        Ok(access_token)
    }

    /// Example: Fetch transactions using an access token
    /// 
    /// This can be called anytime after you have an access token.
    pub async fn example_fetch_transactions(
        client: &PlaidClient,
    ) -> Result<serde_json::Value> {
        // Fetch last 30 days of transactions
        let end_date = chrono::Utc::now().date_naive();
        let start_date = end_date - chrono::Duration::days(30);

        let transactions = client.get_transactions(start_date, end_date).await?;

        Ok(transactions)
    }

    /// Example: Using PlaidConnection with the SyncedConnection trait
    /// 
    /// This demonstrates how Plaid integrates with the broader synced data framework.
    pub async fn example_synced_connection() -> Result<()> {
        // Create a connection configuration
        let connection = PlaidConnection {
            client_id: "your_client_id".to_string(),
            secret: "your_secret".to_string(),
            environment: PlaidEnvironment::Sandbox,
            start_date: "2024-01-01".to_string(),
            // Access token would be set after the Link flow completes
            access_token: Some("access_token_from_exchange".to_string()),
        };

        // Convert to a client
        let client = connection.to_client().await?;

        // Get available streams
        let streams = connection.streams();
        println!("Available streams: {:?}", streams);

        // Process the transactions stream
        let start_date = connection.start_date();
        let end_date = chrono::Utc::now().date_naive();
        
        let data = client.process("transactions", start_date, end_date).await?;
        
        // data is a HashMap<String, Bytes> where:
        // - Key: "transactions"
        // - Value: Parquet-encoded transaction data
        
        Ok(())
    }

    /// Example: Complete flow from start to finish
    pub async fn example_complete_flow() -> Result<()> {
        // Step 1: Initialize client
        let mut client = PlaidClient::new(
            "your_client_id",
            "your_secret",
            PlaidEnvironment::Sandbox,
        );

        // Step 2: Create link token (backend)
        let link_token = client.create_link_token("user_123", "Quadratic").await?;
        println!("Link token created: {}", link_token);

        // Step 3: Frontend flow (simulated here)
        // In reality, this happens in the browser:
        // - User opens Plaid Link with the link_token
        // - User selects "First Platypus Bank" (for sandbox)
        // - User enters credentials: user_good / pass_good
        // - Plaid Link returns a public_token
        let public_token = "public-sandbox-xxxxxx"; // This comes from frontend

        // Step 4: Exchange public token for access token (backend)
        let access_token = client.exchange_public_token(public_token).await?;
        println!("Access token obtained: {}", access_token);

        // Step 5: Fetch transactions (backend)
        let end_date = chrono::Utc::now().date_naive();
        let start_date = end_date - chrono::Duration::days(30);
        let transactions = client.get_transactions(start_date, end_date).await?;
        
        println!("Transactions fetched: {:?}", transactions);

        Ok(())
    }

    /// Example: Testing connection
    pub async fn example_test_connection(client: &PlaidClient) -> Result<bool> {
        let is_connected = client.test_connection().await;
        
        if is_connected {
            println!("✓ Plaid connection is working");
        } else {
            println!("✗ Plaid connection failed");
        }

        Ok(is_connected)
    }

    /// Example: Error handling
    pub async fn example_error_handling() -> Result<()> {
        let client = PlaidClient::new(
            "invalid_client_id",
            "invalid_secret",
            PlaidEnvironment::Sandbox,
        );

        match client.create_link_token("user_123", "Quadratic").await {
            Ok(token) => {
                println!("Link token: {}", token);
            }
            Err(e) => {
                // Handle different error types
                eprintln!("Error creating link token: {}", e);
                // In a real app, you might:
                // - Log the error
                // - Return an appropriate HTTP status code
                // - Show a user-friendly error message
            }
        }

        Ok(())
    }
}

/// Frontend integration example (TypeScript/React)
/// 
/// This is example code showing how the frontend would integrate with Plaid Link.
/// Save this as a separate .tsx file in your frontend application.
#[allow(dead_code)]
const _FRONTEND_EXAMPLE: &str = r#"
import React, { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  userId: string;
}

export const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({ userId }) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Step 1: Fetch link token from your backend
  const fetchLinkToken = async () => {
    const response = await fetch('/api/plaid/create-link-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await response.json();
    setLinkToken(data.linkToken);
  };

  // Step 2: Handle successful link
  const onSuccess = useCallback(async (publicToken: string, metadata: any) => {
    // Send public token to your backend to exchange for access token
    await fetch('/api/plaid/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        publicToken,
        userId,
        metadata,
      }),
    });
    
    console.log('Successfully linked account!');
  }, [userId]);

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err, metadata) => {
      if (err) {
        console.error('Plaid Link error:', err);
      }
    },
  });

  return (
    <div>
      {!linkToken && (
        <button onClick={fetchLinkToken}>
          Initialize Plaid Link
        </button>
      )}
      {linkToken && (
        <button onClick={() => open()} disabled={!ready}>
          Connect Bank Account
        </button>
      )}
    </div>
  );
};
"#;

/// Backend API endpoint example (Rust/Axum)
/// 
/// This shows how you might structure your backend API endpoints.
#[allow(dead_code)]
const _BACKEND_API_EXAMPLE: &str = r#"
use axum::{
    extract::{State, Json},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct CreateLinkTokenRequest {
    user_id: String,
}

#[derive(Serialize)]
struct CreateLinkTokenResponse {
    link_token: String,
}

#[derive(Deserialize)]
struct ExchangeTokenRequest {
    public_token: String,
    user_id: String,
}

// POST /api/plaid/create-link-token
async fn create_link_token(
    State(plaid_client): State<PlaidClient>,
    Json(payload): Json<CreateLinkTokenRequest>,
) -> Result<Json<CreateLinkTokenResponse>, StatusCode> {
    let link_token = plaid_client
        .create_link_token(&payload.user_id, "Quadratic")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(CreateLinkTokenResponse { link_token }))
}

// POST /api/plaid/exchange-token
async fn exchange_token(
    State(mut plaid_client): State<PlaidClient>,
    Json(payload): Json<ExchangeTokenRequest>,
) -> Result<StatusCode, StatusCode> {
    let access_token = plaid_client
        .exchange_public_token(&payload.public_token)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Store access_token in database associated with user_id
    // store_access_token(&payload.user_id, &access_token).await?;

    Ok(StatusCode::OK)
}
"#;

