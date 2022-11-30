use petgraph::algo::is_cyclic_directed;
use petgraph::dot::Dot;
use petgraph::graphmap::DiGraphMap;
use petgraph::visit::Bfs;
use std::fmt;

#[derive(Copy, Clone, Eq, PartialEq, Ord, PartialOrd, Hash, Debug)]
pub struct CellPosition {
    x: usize,
    y: usize,
}

impl fmt::Display for CellPosition {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}

#[derive(Default, Clone)]
pub struct DGraphController {
    graph: DiGraphMap<CellPosition, usize>,
}

impl DGraphController {
    /// Constructs a new empty dgraph.
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_dependencies_to_graph(
        &mut self,
        input_cells: Vec<CellPosition>,
        dependent_cells: Vec<CellPosition>,
    ) {
        for icell in input_cells {
            self.graph.add_node(icell);
            for dcell in dependent_cells.clone() {
                self.graph.add_node(dcell);
                self.graph.add_edge(icell, dcell, 1);
            }
        }

        // check for cycles
        if is_cyclic_directed(&self.graph) {
            panic!("Cyclic dependency detected!");
        }
    }

    pub fn remove_dependencies_from_graph(
        &mut self,
        input_cells: Vec<CellPosition>,
        dependent_cells: Vec<CellPosition>,
    ) {
        for icell in input_cells {
            for dcell in dependent_cells.clone() {
                self.graph.remove_edge(icell, dcell);
            }
        }

        // todo: remove nodes that are not connected to any other nodes
    }

    pub fn get_children_cells(&self, cell: CellPosition) -> Vec<CellPosition> {
        let mut result = Vec::<CellPosition>::new();
        let mut bfs = Bfs::new(&self.graph, cell);
        while let Some(visited) = bfs.next(&self.graph) {
            result.push(visited);
        }
        // return result except the first element (will always be input cell position)
        result[1..].to_vec()
    }

    pub fn get_dot_graph(&self) -> String {
        format!("{}", Dot::new(&self.graph))
    }
}

#[test]
fn test_dgraph_controller() {
    let mut grid = DGraphController::new();

    grid.add_dependencies_to_graph(
        vec![CellPosition { x: 1, y: 3 }],
        vec![CellPosition { x: 1, y: 2 }, CellPosition { x: 1, y: 1 }],
    );
    assert_eq!(
        grid.get_children_cells(CellPosition { x: 1, y: 3 }),
        vec![CellPosition { x: 1, y: 2 }, CellPosition { x: 1, y: 1 },]
    );

    grid.add_dependencies_to_graph(
        vec![CellPosition { x: 1, y: 4 }],
        vec![CellPosition { x: 1, y: 3 }],
    );
    assert_eq!(
        grid.get_children_cells(CellPosition { x: 1, y: 4 }),
        vec![
            CellPosition { x: 1, y: 3 },
            CellPosition { x: 1, y: 2 },
            CellPosition { x: 1, y: 1 },
        ]
    );

    grid.add_dependencies_to_graph(
        vec![CellPosition { x: 2, y: 3 }],
        vec![CellPosition { x: 1, y: 2 }, CellPosition { x: 1, y: 1 }],
    );
    assert_eq!(
        grid.get_children_cells(CellPosition { x: 2, y: 3 }),
        vec![CellPosition { x: 1, y: 2 }, CellPosition { x: 1, y: 1 },]
    );

    grid.add_dependencies_to_graph(
        vec![CellPosition { x: 3, y: 3 }],
        vec![CellPosition { x: 2, y: 3 }, CellPosition { x: 1, y: 4 }],
    );
    assert_eq!(
        grid.get_children_cells(CellPosition { x: 3, y: 3 }),
        vec![
            CellPosition { x: 2, y: 3 },
            CellPosition { x: 1, y: 4 },
            CellPosition { x: 1, y: 2 },
            CellPosition { x: 1, y: 1 },
            CellPosition { x: 1, y: 3 },
        ]
    );

    grid.add_dependencies_to_graph(
        vec![CellPosition { x: 10, y: 8 }],
        vec![CellPosition { x: 10, y: 9 }, CellPosition { x: 10, y: 10 }],
    );
    assert_eq!(
        grid.get_children_cells(CellPosition { x: 10, y: 8 }),
        vec![CellPosition { x: 10, y: 9 }, CellPosition { x: 10, y: 10 },]
    );

    grid.add_dependencies_to_graph(
        vec![CellPosition { x: 10, y: 8 }],
        vec![CellPosition { x: 3, y: 3 }],
    );
    assert_eq!(
        grid.get_children_cells(CellPosition { x: 10, y: 8 }),
        vec![
            CellPosition { x: 10, y: 9 },
            CellPosition { x: 10, y: 10 },
            CellPosition { x: 3, y: 3 },
            CellPosition { x: 2, y: 3 },
            CellPosition { x: 1, y: 4 },
            CellPosition { x: 1, y: 2 },
            CellPosition { x: 1, y: 1 },
            CellPosition { x: 1, y: 3 },
        ]
    );

    // test non existant nodes
    assert_eq!(grid.get_children_cells(CellPosition { x: 50, y: 50 }), []);

    println!("{}", grid.get_dot_graph());

    //   // Test remove_dependency_from_graph
    //   dg.remove_dependency_from_graph([10, 8], [[3, 3]]);
    grid.remove_dependencies_from_graph(
        vec![CellPosition { x: 10, y: 8 }],
        vec![CellPosition { x: 3, y: 3 }],
    );
    assert_eq!(
        grid.get_children_cells(CellPosition { x: 10, y: 8 }),
        vec![CellPosition { x: 10, y: 9 }, CellPosition { x: 10, y: 10 },]
    );

    grid.remove_dependencies_from_graph(
        vec![CellPosition { x: 10, y: 8 }],
        vec![CellPosition { x: 10, y: 9 }, CellPosition { x: 10, y: 10 }],
    );
    grid.remove_dependencies_from_graph(
        vec![CellPosition { x: 3, y: 3 }],
        vec![CellPosition { x: 2, y: 3 }, CellPosition { x: 1, y: 4 }],
    );
    grid.remove_dependencies_from_graph(
        vec![CellPosition { x: 2, y: 3 }],
        vec![CellPosition { x: 1, y: 2 }, CellPosition { x: 1, y: 1 }],
    );
    grid.remove_dependencies_from_graph(
        vec![CellPosition { x: 1, y: 4 }],
        vec![CellPosition { x: 1, y: 3 }],
    );
    grid.remove_dependencies_from_graph(
        vec![CellPosition { x: 1, y: 3 }],
        vec![CellPosition { x: 1, y: 2 }, CellPosition { x: 1, y: 1 }],
    );

    println!("{}", grid.get_dot_graph());

    //   expect(dg._dgraph.getEdgesCount()).toEqual(0);

    //   // TODO clean up isolate nodes, this should be 0.
    //   expect(dg._dgraph.getVerticesCount()).toEqual(9);

    //   // Test CircularReferenceException, should throw error
    //   // dg.add_dependency_to_graph([1, 2], [[3, 3]]);
}

#[test]
fn test_dgraph() {
    let mut graph = DiGraphMap::<CellPosition, usize>::new();
    let origin = graph.add_node(CellPosition { x: 0, y: 0 });
    let destination_1 = graph.add_node(CellPosition { x: 0, y: 1 });
    let destination_2 = graph.add_node(CellPosition { x: 0, y: 2 });
    graph.add_edge(origin, destination_1, 1);
    graph.add_edge(origin, destination_2, 1);

    let n_1_0 = graph.add_node(CellPosition { x: 1, y: 0 });

    let origin2 = graph.add_node(CellPosition { x: 0, y: 0 });
    let destination_3 = graph.add_node(CellPosition { x: 0, y: 1 });
    graph.add_edge(origin2, destination_3, 1);

    // outputs the graph in the DOT language (http://viz-js.com/)
    println!("{}", Dot::new(&graph));

    // bredth first search
    let mut bfs = Bfs::new(&graph, n_1_0);

    print!("[{}] ", n_1_0);
    while let Some(visited) = bfs.next(&graph) {
        print!(" {}", visited);
    }
    println!();

    // detect cycles
    let is_cyclic = is_cyclic_directed(&graph);
    println!("is_cyclic: {}", is_cyclic);
    // make cycle
    graph.add_edge(destination_1, origin, 1);
    let is_cyclic = is_cyclic_directed(&graph);
    println!("is_cyclic: {}", is_cyclic);

    // panic to show output
}
