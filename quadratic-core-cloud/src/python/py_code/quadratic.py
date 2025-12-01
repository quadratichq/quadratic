import sys
import types

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

class MicropipMock:
    """Mock implementation of micropip for use outside Pyodide/WASM environments"""
    async def install(self, package: str):
        import subprocess
        import shutil
        # Use uv for fast package installation
        uv_exe = shutil.which("uv")
        if uv_exe:
            subprocess.check_call([uv_exe, "pip", "install", "--user", package])
        else:
            # Fallback to pip if uv is not available
            import pip
            pip.main(["install", package])

# Create a fake module for micropip so that "import micropip" works
_micropip_module = types.ModuleType('micropip')
_micropip_instance = MicropipMock()
_micropip_module.install = _micropip_instance.install
sys.modules['micropip'] = _micropip_module
        
