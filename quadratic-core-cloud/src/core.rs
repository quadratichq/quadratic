use std::sync::Arc;
use tokio::{
    runtime::Handle,
    sync::{Mutex, mpsc},
    task::JoinHandle,
};

use quadratic_core::{
    controller::{
        GridController, active_transactions::transaction_name::TransactionName,
        execution::run_code::get_cells::JsCellsA1Response, operations::operation::Operation,
    },
    grid::CodeCellLanguage,
};
use uuid::Uuid;

use crate::{
    connection::{ConnectionParams, fetch_stock_prices, run_connection},
    error::{CoreCloudError, Result},
    javascript::{JavaScriptTcpServer, run_javascript},
    python::{execute::run_python, quadratic::FetchStockPricesFn},
};

// from main
// receive the transaction
// get file from S3
// enter the multiplayer room
// receive catchup transactions if any (receive transactions)
// process transactions
// send forward transactions to multiplayer

/// Process a transaction.
///
/// This function will start a transaction and wait for the result.
/// If the transaction times out, it will return an error.
pub async fn process_transaction(
    grid: Arc<Mutex<GridController>>,
    operations: Vec<Operation>,
    cursor: Option<String>,
    transaction_name: TransactionName,
    team_id: String,
    token: String,
    connection_url: String,
) -> Result<Uuid> {
    tracing::trace!("[Core] Starting transaction processing");

    // get_cells request channel
    let (tx_get_cells_request, mut rx_get_cells_request) = mpsc::channel::<String>(32);
    let tx_get_cells_request = Arc::new(Mutex::new(tx_get_cells_request));

    // get_cells response channel
    let (tx_get_cells_response, rx_get_cells_response) = mpsc::channel::<JsCellsA1Response>(32);
    let rx_get_cells_response = Arc::new(Mutex::new(rx_get_cells_response));

    // kick off the transaction
    let transaction_id =
        grid.lock()
            .await
            .start_user_ai_transaction(operations, cursor, transaction_name, false);
    let transaction_uuid = Uuid::parse_str(&transaction_id)?;

    tracing::debug!("[Core] Transaction started with ID: {transaction_id}");

    // in a separate thread, listen for get_cells calls
    let transaction_id_clone = transaction_id.clone();
    let grid_clone = Arc::clone(&grid);
    let task_handle: JoinHandle<Result<()>> = tokio::spawn(async move {
        while let Some(a1) = rx_get_cells_request.recv().await {
            // lock the grid and get the cells
            let cells = Arc::clone(&grid_clone)
                .lock()
                .await
                .calculation_get_cells_a1(transaction_id_clone.clone(), a1);

            // send the get_cells response
            tx_get_cells_response.send(cells).await?;
        }

        Ok(())
    });

    // closure factory to create get_cells for each iteration
    let tx_req = Arc::clone(&tx_get_cells_request);
    let rx_resp = Arc::clone(&rx_get_cells_response);
    let create_get_cells = || {
        let tx = Arc::clone(&tx_req);
        let rx = Arc::clone(&rx_resp);
        move |a1: String| {
            //  blocking is required here
            tokio::task::block_in_place(|| {
                Handle::current().block_on(async {
                    // send the request
                    tx.lock().await.send(a1).await?;

                    // receive and return the response
                    rx.lock().await.recv().await.ok_or_else(|| {
                        CoreCloudError::Python("Error receiving get_cells response".to_string())
                    })
                })
            })
        }
    };

    // closure factory to create fetch_stock_prices callbacks for each iteration.
    // The token/team_id/connection_url are captured here and never passed into
    // the Python execution context, keeping auth credentials inaccessible to
    // user-authored Python code.
    let create_fetch_stock_prices = {
        let token = token.clone();
        let team_id = team_id.clone();
        let connection_url = connection_url.clone();
        move || -> FetchStockPricesFn {
            let token = token.clone();
            let team_id = team_id.clone();
            let connection_url = connection_url.clone();
            Box::new(
                move |identifier: String,
                      start_date: Option<String>,
                      end_date: Option<String>,
                      frequency: Option<String>|
                      -> std::result::Result<serde_json::Value, String> {
                    tokio::task::block_in_place(|| {
                        Handle::current().block_on(async {
                            fetch_stock_prices(
                                &token,
                                &team_id,
                                &connection_url,
                                &identifier,
                                start_date.as_deref(),
                                end_date.as_deref(),
                                frequency.as_deref(),
                            )
                            .await
                            .map_err(|e| e.to_string())
                        })
                    })
                },
            )
        }
    };

    // Start a persistent JavaScript TCP server for this transaction
    // This server will be reused across all JavaScript code executions
    let js_tcp_server = JavaScriptTcpServer::start(Box::new(create_get_cells())).await?;
    let js_port = js_tcp_server.port();

    // loop until error
    loop {
        // get the async transaction
        let async_transaction = grid
            .lock()
            .await
            .active_transactions()
            .get_async_transaction(transaction_uuid);

        let (code_run_clone, current_sheet_pos) = if let Ok(async_transaction) = async_transaction
            && let Some(sheet_pos) = async_transaction.current_sheet_pos
        {
            let code_run = grid
                .lock()
                .await
                .try_sheet(sheet_pos.sheet_id)
                .and_then(|sheet| sheet.code_run_at(&sheet_pos.into()))
                .cloned();
            (code_run, Some(sheet_pos))
        } else {
            (None, None)
        };

        if let Some(code_run) = code_run_clone {
            // run code
            match &code_run.language {
                CodeCellLanguage::Python => {
                    run_python(
                        Arc::clone(&grid),
                        &code_run.code,
                        &transaction_id,
                        Box::new(create_get_cells()),
                        create_fetch_stock_prices(),
                    )
                    .await?;
                }
                CodeCellLanguage::Javascript => {
                    run_javascript(Arc::clone(&grid), &code_run.code, &transaction_id, js_port)
                        .await?;
                }
                CodeCellLanguage::Connection { kind, id } => {
                    // Get the sheet_id from the current sheet_pos for handlebars replacement
                    let sheet_id = current_sheet_pos.map(|sp| sp.sheet_id).ok_or_else(|| {
                        CoreCloudError::Core(
                            "No sheet_id available for connection execution".into(),
                        )
                    })?;

                    run_connection(ConnectionParams {
                        grid: Arc::clone(&grid),
                        query: &code_run.code,
                        connection_kind: *kind,
                        connection_id: id,
                        transaction_id: &transaction_id,
                        team_id: &team_id,
                        token: &token,
                        connection_url: &connection_url,
                        sheet_id,
                    })
                    .await?;
                }
                // maybe skip these below?
                CodeCellLanguage::Formula => todo!(),
                CodeCellLanguage::Import => todo!(),
            }

            // Continue looping - don't abort task yet
        } else {
            // No more code_run, break out of loop
            tracing::info!("[Core] No more code to execute for transaction: {transaction_id}",);
            break;
        }
    }

    // Shutdown the JavaScript TCP server gracefully
    js_tcp_server.shutdown().await;

    // Abort the task
    task_handle.abort();

    // wait for the task to finish
    if let Err(e) = task_handle.await
        && !e.is_cancelled()
    {
        return Err(CoreCloudError::Core(e.to_string()));
    }

    // // Return the grid
    // let strong_count = Arc::strong_count(&grid_shared);
    // return match Arc::try_unwrap(grid_shared) {
    //     Ok(mutex) => Ok(mutex.into_inner().unwrap()),
    //     Err(_) => Err(CoreCloudError::Python(format!(
    //         "Unable to return the grid because of strong_count of the Arc: {:?}",
    //         strong_count
    //     ))),
    // };

    Ok(transaction_uuid)
}

#[cfg(test)]
mod tests {
    use super::*;

    use quadratic_core::{
        CellValue, Pos, Value,
        controller::{GridController, operations::operation::Operation},
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind, Grid},
        number::decimal_from_str,
        pos,
    };

    async fn test_language(language: CodeCellLanguage, code: &str) -> CellValue {
        let grid = Arc::new(Mutex::new(GridController::from_grid(Grid::test(), 0)));
        let sheet_id = grid.lock().await.sheet_ids()[0];
        let mut grid_lock = grid.lock().await;
        let sheet = grid_lock.try_sheet_mut(sheet_id).unwrap();
        let to_number = |s: &str| CellValue::Number(decimal_from_str(s).unwrap());
        let team_id = "test_team_id".to_string();
        let token = "M2M_AUTH_TOKEN".to_string();

        // set A1 to 1
        sheet.set_cell_values(pos![A1].into(), to_number("1").into());

        // set A2 to a code cell by creating a DataTable with CodeRun
        let code_run = CodeRun {
            language,
            code: code.to_string(),
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: None,
            line_number: None,
            output_type: None,
        };

        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "TestCodeCell",
            Value::Single(CellValue::Blank),
            false,
            Some(false),
            Some(false),
            None,
        );

        sheet.data_table_insert_full(Pos { x: 1, y: 2 }, data_table); // A2

        // generate the operation
        let operation = Operation::ComputeCode {
            sheet_pos: pos![A2].to_sheet_pos(sheet_id),
        };

        // Drop the grid_lock before calling process_transaction to avoid deadlock
        drop(grid_lock);

        // process the transaction
        let connection_url = "http://localhost:3003".to_string();
        process_transaction(
            Arc::clone(&grid),
            vec![operation],
            None,
            TransactionName::Unknown,
            team_id,
            token,
            connection_url,
        )
        .await
        .unwrap();

        grid.lock()
            .await
            .try_sheet(sheet_id)
            .unwrap()
            .display_value(pos![A2])
            .unwrap()
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_core_python() {
        let python_code = "q.cells('A1') +  10".to_string();
        let python_value = test_language(CodeCellLanguage::Python, &python_code).await;
        assert_eq!(
            python_value,
            CellValue::Number(decimal_from_str("11").unwrap())
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_core_javascript() {
        let javascript_code = "return await q.cells('A1') +  10".to_string();
        let javascript_value = test_language(CodeCellLanguage::Javascript, &javascript_code).await;
        assert_eq!(
            javascript_value,
            CellValue::Number(decimal_from_str("11").unwrap())
        );
    }

    #[tokio::test]
    async fn test_code_cell_setup() {
        // Test that we can properly set up a code cell using DataTable instead of CellValue::Code
        let grid = Arc::new(Mutex::new(GridController::test()));
        let sheet_id = grid.lock().await.sheet_ids()[0];
        let mut grid_lock = grid.lock().await;
        let sheet = grid_lock.try_sheet_mut(sheet_id).unwrap();

        // Create a code run
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "test_code".to_string(),
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: None,
            line_number: None,
            output_type: None,
        };

        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "TestCodeCell",
            Value::Single(CellValue::Blank),
            false,
            Some(false),
            Some(false),
            None,
        );

        sheet.data_table_insert_full(Pos { x: 1, y: 2 }, data_table); // A2

        // Verify the code run was set up correctly
        let retrieved_code_run = sheet.code_run_at(&Pos { x: 1, y: 2 });
        assert!(retrieved_code_run.is_some());
        let retrieved_code_run = retrieved_code_run.unwrap();
        assert_eq!(retrieved_code_run.code, "test_code");
        assert_eq!(retrieved_code_run.language, CodeCellLanguage::Python);
    }
}
