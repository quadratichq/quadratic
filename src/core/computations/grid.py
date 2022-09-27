import numbers
import pandas as pd


# Grid data
class QuadraticGrid:
    def __init__(self):

        # Init a blank datagrid
        self.grid_data = pd.DataFrame()
        self.cell_types = pd.DataFrame()
        self.h_lines = pd.DataFrame()
        self.v_lines = pd.DataFrame()

        self.code_cells = {}

        self.column_widths = {}  # only stores non default ones
        self.row_widths = {}  # only stores non default ones

    def insert_value_at_cell(self, value, cell_ref):
        x = cell_ref[0]
        y = cell_ref[1]

        self.grid_data[x][y] = value

    def delete_value_at_cell(self, value, cell_ref):
        pass

    def get_window_of_data(
        self, left_bound_cell_ref, right_bound_cell_ref, detail_level=1
    ):
        pass


qg = QuadraticGrid()
qg.insert_value_at_cell("10", (0, 0))
