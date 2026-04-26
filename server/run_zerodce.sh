#!/bin/bash
# Wrapper script to run Zero-DCE++ with system Python 3.11
# This ensures we use the correct Python and not uv's version

# Clear any uv-related environment variables
unset UV_PYTHON_INSTALL_DIR
unset UV_PYTHON_PREFERENCE
unset VIRTUAL_ENV
unset PYTHONHOME

# Set minimal PATH to avoid uv's Python
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PYTHONDONTWRITEBYTECODE=1

# Run with explicit Python 3.11
exec /usr/bin/python3.11 "$@"
