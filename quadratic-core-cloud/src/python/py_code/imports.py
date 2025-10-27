import ast
import subprocess
import sys

def auto_install(package):
    try:
        __import__(package)
    except ImportError:
        print(f"Installing {package}...")
        # Use uv for fast package installation
        import shutil
        uv_exe = shutil.which("uv")
        if uv_exe:
            # Use uv pip install with --user flag to install to /root/.local (mounted volume)
            subprocess.check_call([uv_exe, "pip", "install", "--user", package])
        else:
            # Fallback to python -m pip if uv is not available
            python_exe = shutil.which("python3") or shutil.which("python")
            if python_exe:
                subprocess.check_call([python_exe, "-m", "pip", "install", "--user", "--break-system-packages", package])
            else:
                subprocess.check_call(["pip", "install", "--user", "--break-system-packages", package])
        __import__(package)

# Function to extract import statements using AST and auto-install
def process_imports_ast(code):
    """
    Use AST to properly parse and extract all import statements from code.
    Handles complex imports, aliases, multi-line imports, etc.
    """
    try:
        tree = ast.parse(code)
        
        # Extract all unique imports using ast.walk
        all_imports = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                # Handle "import module" or "import module as alias"
                for alias in node.names:
                    module_name = alias.name.split('.')[0]  # Get root module
                    all_imports.add(module_name)
            
            elif isinstance(node, ast.ImportFrom):
                # Handle "from module import ..." statements  
                if node.module:  # Skip relative imports like "from . import"
                    module_name = node.module.split('.')[0]  # Get root module
                    all_imports.add(module_name)
        
        # Auto-install each unique module
        for module in all_imports:
            auto_install(module)
            
    except SyntaxError as e:
        # If AST parsing fails, fall back to the simple line-by-line approach
        print(f"Warning: AST parsing failed ({e}), falling back to simple import detection")
        lines = code.split('\\n')
        for line in lines:
            line = line.strip()
            if line.startswith('import '):
                try:
                    module = line.split()[1].split('.')[0]
                    auto_install(module)
                except (IndexError, AttributeError):
                    pass  # Skip malformed import lines
            elif line.startswith('from '):
                try:
                    module = line.split()[1].split('.')[0]
                    auto_install(module)
                except (IndexError, AttributeError):
                    pass  # Skip malformed import lines