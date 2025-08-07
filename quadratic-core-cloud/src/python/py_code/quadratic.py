class Q:
    def __init__(self):
        pass
    
    def cells(self, a1, first_row_header=False):
        # Call the Rust function with first_row_header parameter
        return rust_cells(a1, first_row_header)
    
    def pos(self):
        # Call the Rust function  
        return rust_pos()

q = Q()

class micropip:
    async def install(self, package: str):
        pip.main(["install", package])

micropip = micropip()
        
