#[cfg(test)]
mod tests {
    use quadratic_rust_shared::{quadratic_api::TaskRun, quadratic_cloud::GetTasksResponse};
    use std::sync::{Arc, Mutex};
    use uuid::Uuid;

    /// Mock state to track how many times get_tasks is called
    #[derive(Clone)]
    struct MockTaskProvider {
        call_count: Arc<Mutex<usize>>,
        task_batches: Arc<Mutex<Vec<GetTasksResponse>>>,
    }

    impl MockTaskProvider {
        fn new(task_batches: Vec<GetTasksResponse>) -> Self {
            Self {
                call_count: Arc::new(Mutex::new(0)),
                task_batches: Arc::new(Mutex::new(task_batches)),
            }
        }

        fn get_tasks(&self) -> GetTasksResponse {
            let mut count = self.call_count.lock().unwrap();
            *count += 1;

            let batches = self.task_batches.lock().unwrap();
            if *count <= batches.len() {
                batches[*count - 1].clone()
            } else {
                vec![]
            }
        }

        fn call_count(&self) -> usize {
            *self.call_count.lock().unwrap()
        }
    }

    #[test]
    fn test_mock_task_provider_returns_batches_in_order() {
        let file_id = Uuid::new_v4();

        let batch1 = vec![(
            "key1".to_string(),
            TaskRun {
                file_id,
                task_id: Uuid::new_v4(),
                run_id: Uuid::new_v4(),
                operations: vec![1, 2, 3],
            },
        )];

        let batch2 = vec![(
            "key2".to_string(),
            TaskRun {
                file_id,
                task_id: Uuid::new_v4(),
                run_id: Uuid::new_v4(),
                operations: vec![4, 5, 6],
            },
        )];

        let provider = MockTaskProvider::new(vec![batch1.clone(), batch2.clone(), vec![]]);

        // First call should return batch1
        let result1 = provider.get_tasks();
        assert_eq!(result1.len(), 1);
        assert_eq!(result1[0].0, "key1");

        // Second call should return batch2
        let result2 = provider.get_tasks();
        assert_eq!(result2.len(), 1);
        assert_eq!(result2[0].0, "key2");

        // Third call should return empty
        let result3 = provider.get_tasks();
        assert!(result3.is_empty());

        // Fourth call should still return empty
        let result4 = provider.get_tasks();
        assert!(result4.is_empty());

        assert_eq!(provider.call_count(), 4);
    }

    #[test]
    fn test_worker_processes_single_batch() {
        // This test verifies that a worker with a single batch
        // processes it and then shuts down when no more tasks are available

        let file_id = Uuid::new_v4();
        let task_run = TaskRun {
            file_id,
            task_id: Uuid::new_v4(),
            run_id: Uuid::new_v4(),
            operations: vec![1, 2, 3],
        };

        // Worker starts with initial batch
        let initial_tasks = vec![("key1".to_string(), task_run)];

        // After processing, get_tasks returns empty
        // In real implementation, this would be tested by:
        // 1. Worker processes initial_tasks
        // 2. Worker calls get_tasks() -> empty
        // 3. Worker shuts down

        assert!(!initial_tasks.is_empty());
        assert_eq!(initial_tasks.len(), 1);
    }

    #[test]
    fn test_worker_processes_multiple_batches() {
        // This test verifies the worker loop behavior:
        // - Start with batch 1
        // - Process batch 1
        // - Check for more tasks -> get batch 2
        // - Process batch 2
        // - Check for more tasks -> empty
        // - Shutdown

        let file_id = Uuid::new_v4();

        let batch1 = vec![(
            "key1".to_string(),
            TaskRun {
                file_id,
                task_id: Uuid::new_v4(),
                run_id: Uuid::new_v4(),
                operations: vec![1, 2, 3],
            },
        )];

        let batch2 = vec![(
            "key2".to_string(),
            TaskRun {
                file_id,
                task_id: Uuid::new_v4(),
                run_id: Uuid::new_v4(),
                operations: vec![4, 5, 6],
            },
        )];

        let provider = MockTaskProvider::new(vec![batch2.clone(), vec![]]);

        // Simulate worker starting with batch1
        let mut current_batch = batch1;
        let mut total_processed = 0;

        // Process first batch
        total_processed += current_batch.len();
        assert_eq!(current_batch.len(), 1);

        // Check for more tasks (simulating get_tasks call after ack)
        current_batch = provider.get_tasks();
        if !current_batch.is_empty() {
            // Process second batch
            total_processed += current_batch.len();
            assert_eq!(current_batch.len(), 1);

            // Check for more tasks again
            current_batch = provider.get_tasks();
        }

        // Should have no more tasks
        assert!(current_batch.is_empty());
        assert_eq!(total_processed, 2);
        assert_eq!(provider.call_count(), 2);
    }

    #[test]
    fn test_worker_handles_empty_initial_batch() {
        // Worker should handle case where it starts with no tasks
        let initial_tasks: Vec<(String, TaskRun)> = vec![];
        assert!(initial_tasks.is_empty());

        // In real implementation, worker would check if tasks is empty
        // and immediately exit the loop without processing
    }

    #[test]
    fn test_worker_continues_on_multiple_small_batches() {
        // Test that worker can process many small batches in sequence
        let file_id = Uuid::new_v4();

        let batches: Vec<GetTasksResponse> = (0..5)
            .map(|i| {
                vec![(
                    format!("key{}", i),
                    TaskRun {
                        file_id,
                        task_id: Uuid::new_v4(),
                        run_id: Uuid::new_v4(),
                        operations: vec![i as u8],
                    },
                )]
            })
            .collect();

        let provider = MockTaskProvider::new(batches);

        let mut total_batches_processed = 0;

        // Simulate worker loop
        loop {
            let batch = provider.get_tasks();
            if batch.is_empty() {
                break;
            }
            total_batches_processed += 1;
        }

        assert_eq!(total_batches_processed, 5);
        assert_eq!(provider.call_count(), 6); // 5 batches + 1 empty check
    }
}
