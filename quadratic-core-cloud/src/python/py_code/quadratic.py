import sys
import types


class Financial:
    """Financial data module for accessing stock prices and other financial data."""
    
    def stock_prices(self, identifier, start_date=None, end_date=None, frequency=None):
        """
        Get historical stock prices for a security.
        
        Args:
            identifier: Stock ticker symbol (e.g., "AAPL")
            start_date: Optional start date in YYYY-MM-DD format
            end_date: Optional end date in YYYY-MM-DD format
            frequency: Optional frequency for price data ("daily", "weekly", "monthly", "quarterly", "yearly"). Defaults to "daily".
            
        Returns:
            Dictionary containing stock price data
        """
        return rust_stock_prices(identifier, start_date, end_date, frequency)


class Q:
    def __init__(self):
        self._financial = Financial()
    
    @property
    def financial(self):
        """Access financial data functions."""
        return self._financial
    
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
        import importlib
        
        # First check if the package is already installed
        try:
            importlib.import_module(package)
            # Package already available, no need to install
            return
        except ImportError:
            pass
        
        # Use uv for fast package installation
        uv_exe = shutil.which("uv")
        if uv_exe:
            subprocess.check_call([uv_exe, "pip", "install", "--system", package])
        else:
            # Fallback to pip if uv is not available
            python_exe = shutil.which("python3") or shutil.which("python")
            if python_exe:
                subprocess.check_call([python_exe, "-m", "pip", "install", "--user", "--break-system-packages", package])
            else:
                import pip
                pip.main(["install", package])

# Create a fake module for micropip so that "import micropip" works
_micropip_module = types.ModuleType('micropip')
_micropip_instance = MicropipMock()
_micropip_module.install = _micropip_instance.install
sys.modules['micropip'] = _micropip_module
        
