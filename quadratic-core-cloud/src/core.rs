use std::sync::Arc;
use tokio::{
    runtime::Handle,
    sync::{Mutex, mpsc},
    task::JoinHandle,
};

use quadratic_core::controller::{
    GridController, active_transactions::transaction_name::TransactionName,
    execution::run_code::get_cells::JsCellsA1Response, operations::operation::Operation,
};
use uuid::Uuid;

use crate::{
    error::{CoreCloudError, Result},
    python::execute::execute,
};

// from main
// receive the transaction
// get file from S3
// enter the multiplayer room
// receive catchup transactions if any (receive transansactions)
// process python code
// send forward transactions to multiplayer

/// Process a transaction.
///
/// This function will start a transaction and wait for the result.
/// If the transaction times out, it will return an error.
pub(crate) async fn process_transaction(
    grid: Arc<Mutex<GridController>>,
    operations: Vec<Operation>,
    cursor: Option<String>,
    transaction_name: TransactionName,
) -> Result<()> {
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
            .start_user_transaction(operations, cursor, transaction_name);
    let transaction_uuid = Uuid::parse_str(&transaction_id)?;

    // in a separate thread, listen for get_cells calls
    let transaction_id_clone = transaction_id.clone();
    let grid_clone = grid.clone();
    let task_handle: JoinHandle<Result<()>> = tokio::spawn(async move {
        while let Some(a1) = rx_get_cells_request.recv().await {
            // lock the grid and get the cells
            let cells = grid_clone
                .clone()
                .lock()
                .await
                .calculation_get_cells_a1(transaction_id_clone.clone(), a1);

            // send the get_cells response
            tx_get_cells_response.send(cells).await?;
        }

        return Ok(());
    });

    // get_cells function, blocking is required here
    let get_cells = move |a1: String| {
        tokio::task::block_in_place(|| {
            Handle::current().block_on(async {
                println!("sending get_cells request: {:?}", a1);
                // send the request
                tx_get_cells_request.lock().await.send(a1).await?;

                // receive and return the response
                rx_get_cells_response
                    .lock()
                    .await
                    .recv()
                    .await
                    .ok_or_else(|| {
                        CoreCloudError::Python(format!("Error receiving get_cells response"))
                    })
            })
        })
    };

    // get the async transaction
    let async_transaction = grid
        .lock()
        .await
        .active_transactions()
        .get_async_transaction(transaction_uuid);

    if let Ok(async_transaction) = async_transaction {
        if let Some(waiting_for_async) = async_transaction.waiting_for_async {
            // run python
            let js_code_result = execute(
                &waiting_for_async.code,
                &transaction_id,
                Box::new(get_cells),
            )
            .map_err(|e| CoreCloudError::Python(e.to_string()))?;

            // complete the transaction
            grid.lock()
                .await
                .calculation_complete(js_code_result)
                .map_err(|e| CoreCloudError::Core(e.to_string()))?;

            // Abort the task
            task_handle.abort();

            // wait for the task to finish
            if let Err(e) = task_handle.await {
                if !e.is_cancelled() {
                    return Err(CoreCloudError::Core(e.to_string()));
                }
            }
        }
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

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    use quadratic_core::{
        CellValue,
        controller::{GridController, operations::operation::Operation},
        grid::{CodeCellLanguage, CodeCellValue},
        number::decimal_from_str,
        pos,
    };

    #[tokio::test(flavor = "multi_thread")]
    async fn test_core() {
        let grid = Arc::new(Mutex::new(GridController::test()));
        let sheet_id = grid.lock().await.sheet_ids()[0];
        let mut grid_lock = grid.lock().await;
        let sheet = grid_lock.try_sheet_mut(sheet_id).unwrap();
        let to_number = |s: &str| CellValue::Number(decimal_from_str(s).unwrap());
        let to_code =
            |s: &str| CellValue::Code(CodeCellValue::new(CodeCellLanguage::Python, s.to_string()));

        // set A1 to 1
        sheet.set_cell_values(pos![A1].into(), to_number("1").into());

        // set B2 to a Python cell
        let code = "q.cells('A1') +  10".to_string();
        sheet.set_cell_values(pos![A2].into(), to_code(&code).into());

        // generate the operation
        let operation = Operation::ComputeCode {
            sheet_pos: pos![A2].to_sheet_pos(sheet_id),
        };

        // process the transaction
        process_transaction(
            grid.clone(),
            vec![operation],
            None,
            TransactionName::Unknown,
        )
        .await
        .unwrap();

        let value = grid
            .lock()
            .await
            .try_sheet(sheet_id)
            .unwrap()
            .display_value(pos![A2]);
        assert_eq!(value, Some(to_number("11")));
    }
}
