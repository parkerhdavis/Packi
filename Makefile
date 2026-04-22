.PHONY: help dev dev-frontend down build build-linux build-windows build-macos setup install lint lint-fix format check test typecheck clean version

# ==================================================================
# OS DETECTION
# ==================================================================
ifdef OS
    ifeq ($(OS),Windows_NT)
        UNAME_S := Windows
    else
        UNAME_S := $(shell uname -s 2>/dev/null || echo Windows)
    endif
else
    UNAME_S := $(shell uname -s 2>/dev/null || echo Windows)
endif
ifneq (,$(findstring MINGW,$(UNAME_S)))
    DETECTED_OS := windows
else ifneq (,$(findstring MSYS,$(UNAME_S)))
    DETECTED_OS := windows
else ifneq (,$(findstring CYGWIN,$(UNAME_S)))
    DETECTED_OS := windows
else ifneq (,$(findstring Windows,$(UNAME_S)))
    DETECTED_OS := windows
else ifeq ($(UNAME_S),Linux)
    DETECTED_OS := linux
else ifeq ($(UNAME_S),Darwin)
    DETECTED_OS := macos
else
    DETECTED_OS := windows
endif

# ==================================================================
# PATHS
# ==================================================================
# All Bun/Rust commands dispatch into the desktop app directory.
# Monorepo workspace installs hoist node_modules to the repo root,
# so `bunx tauri` resolves @tauri-apps/cli through walk-up lookup
# rather than a pinned relative path.
DESKTOP_DIR := apps/desktop
FRONTEND_DIR := apps/desktop/frontend
BACKEND_DIR := apps/desktop/backend

ifeq ($(DETECTED_OS),windows)
    SHELL := pwsh.exe
    .SHELLFLAGS := -NoProfile -Command
    BUN := bun
    TAURI := bunx tauri
    MKDIR := New-Item -ItemType Directory -Force -Path
    RM := Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    NULL := $$null
else
    BUN := bun
    TAURI := bunx tauri
    MKDIR := mkdir -p
    RM := rm -rf
    NULL := /dev/null
    ifeq ($(DETECTED_OS),macos)
        SED_INPLACE := sed -i ''
    else
        SED_INPLACE := sed -i
    endif
endif

help:
	@echo "================================================================================"
	@echo "  Packi — Texture Toolkit"
	@echo "================================================================================"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Running (Development):"
	@echo "  dev                - Start Tauri dev server (frontend + Rust hot-reload)"
	@echo "  dev-frontend       - Start Bun dev server only (rapid UI iteration)"
	@echo "  down               - Stop any running dev server"
	@echo ""
	@echo "Building:"
	@echo "  setup              - Install all dependencies (Rust + Bun)"
	@echo "  install            - Alias for setup"
	@echo "  build              - Build for current platform (detects OS)"
	@echo "  build-linux        - Build Linux installers (.deb, .rpm, AppImage)"
	@echo "  build-windows      - Build Windows installers (.msi, .exe)"
	@echo "  build-macos        - Build macOS installers (.dmg, .app)"
	@echo "  check              - Run Rust compiler checks without building"
	@echo ""
	@echo "Quality:"
	@echo "  lint               - Run Biome linter and Rust clippy"
	@echo "  lint-fix           - Run Biome linter with auto-fix"
	@echo "  format             - Format code with Biome and rustfmt"
	@echo "  typecheck          - Run TypeScript type checking"
	@echo "  test               - Run Rust and frontend tests"
	@echo ""
	@echo "Versioning:"
	@echo "  version            - Show current version"
	@echo "  version V=X.Y.Z   - Set version across all config files"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean              - Remove build artifacts and dependencies"
	@echo ""
	@echo "Detected OS: $(DETECTED_OS)"
	@echo "================================================================================"

# ==================================================================
# SERVICE COMMANDS
# ==================================================================

ifeq ($(DETECTED_OS),windows)
dev:
	@echo "Starting Tauri development server (frontend + Rust)..."
	cd $(BACKEND_DIR); $(TAURI) dev

dev-frontend:
	@echo "Starting Bun dev server only (rapid UI iteration)..."
	cd $(DESKTOP_DIR); $(BUN) run dev

down:
	@echo "Stopping dev server..."
	@echo "On Windows, close the terminal running the dev server or use Task Manager."
else
dev:
	@echo "Starting Tauri development server (frontend + Rust)..."
	@EXISTING_PID=$$(lsof -ti :5173 2>/dev/null); \
	if [ -n "$$EXISTING_PID" ]; then \
		echo "  -> WARNING: Port 5173 in use (pid $$EXISTING_PID) — killing to free port"; \
		kill $$EXISTING_PID 2>/dev/null || true; \
		sleep 1; \
	fi
	@echo "  -> Starting Tauri (frontend dev server started by Tauri via beforeDevCommand)..."
	@cd $(BACKEND_DIR) && $(TAURI) dev

down:
	@echo "Stopping Packi dev server..."
	@echo "  -> Checking port 5173..."
	@PORT_PID=$$(lsof -ti :5173 2>/dev/null); \
	if [ -n "$$PORT_PID" ]; then \
		kill $$PORT_PID 2>/dev/null || true; \
		echo "  -> Killed process on port 5173 (pid $$PORT_PID)"; \
	else \
		echo "  -> No dev server running"; \
	fi

dev-frontend:
	@echo "Starting Bun dev server only (rapid UI iteration)..."
	@cd $(DESKTOP_DIR) && $(BUN) run dev
endif

# ==================================================================
# COMMAND MODULES
# ==================================================================

ifeq ($(DETECTED_OS),windows)
setup:
	@echo "Installing all dependencies (Rust + Bun)..."
	@echo "Please ensure Rust and Bun are installed."
	$(BUN) install
	@echo "Setup complete"

install: setup

else
setup:
	@echo "Installing all dependencies (Rust + Bun)..."
	@$(BUN) install
	@echo "Setup complete"

install: setup

endif

ifeq ($(DETECTED_OS),windows)
build:
	@echo "Building Windows installers (.msi, .exe)..."
	@echo "  -> Building frontend..."
	cd $(DESKTOP_DIR); $(BUN) run build
	@echo "  -> Building Tauri app for Windows..."
	$$env:PATH = "$$env:USERPROFILE\.cargo\bin;$$env:PATH"; cd $(BACKEND_DIR); $(TAURI) build
	@echo ""
	@echo "Windows build complete!"
	@echo ""
	@echo "Build outputs in ./target/release/bundle/:"
	@echo "  - MSI Installer:  ./target/release/bundle/msi/"
	@echo "  - NSIS Installer: ./target/release/bundle/nsis/"
else
build:
ifeq ($(DETECTED_OS),linux)
	@$(MAKE) build-linux
else ifeq ($(DETECTED_OS),macos)
	@$(MAKE) build-macos
endif
endif

ifeq ($(DETECTED_OS),windows)
build-linux:
	@echo "ERROR: Linux builds must be run on Linux"
	@exit 1

build-windows:
	@echo "Building Windows installers (.msi, .exe)..."
	@echo "  -> Building frontend..."
	cd $(DESKTOP_DIR); $(BUN) run build
	@echo "  -> Building Tauri app for Windows..."
	$$env:PATH = "$$env:USERPROFILE\.cargo\bin;$$env:PATH"; cd $(BACKEND_DIR); $(TAURI) build
	@echo ""
	@echo "Windows build complete!"

build-macos:
	@echo "ERROR: macOS builds must be run on macOS"
	@exit 1
else
build-linux:
	@echo "Building Linux installers (.deb, .rpm, AppImage)..."
	@echo "  -> Building frontend..."
	@cd $(DESKTOP_DIR) && $(BUN) run build
	@echo "  -> Building Tauri app for Linux..."
	@cd $(BACKEND_DIR) && $(TAURI) build
	@echo ""
	@echo "Linux build complete!"
	@echo ""
	@echo "Build outputs in ./target/release/bundle/:"
	@echo "  - AppImage: ./target/release/bundle/appimage/"
	@echo "  - Debian:   ./target/release/bundle/deb/"
	@echo "  - RPM:      ./target/release/bundle/rpm/"

build-windows:
	@echo "ERROR: Windows builds must be run on Windows"
	@exit 1

build-macos:
	@echo "Building macOS installers (.dmg, .app)..."
	@echo "  -> Building frontend..."
	@cd $(DESKTOP_DIR) && $(BUN) run build
	@echo "  -> Building Tauri app for macOS..."
	@cd $(BACKEND_DIR) && $(TAURI) build
	@echo ""
	@echo "macOS build complete!"
endif

ifeq ($(DETECTED_OS),windows)
check:
	@echo "Running Rust compiler checks..."
	cd $(BACKEND_DIR); cargo check
	@echo "Rust checks passed"
else
check:
	@echo "Running Rust compiler checks..."
	@cd $(BACKEND_DIR) && cargo check
	@echo "Rust checks passed"
endif

# -------------
# Quality
# -------------

ifeq ($(DETECTED_OS),windows)
lint:
	@echo "Linting frontend code..."
	$(BUN)x biome check .
	@echo "Linting Rust code..."
	cd $(BACKEND_DIR); cargo clippy -- -D warnings
	@echo "Lint complete"

lint-fix:
	@echo "Fixing frontend lint issues..."
	$(BUN)x biome check --write .
	@echo "Lint fix complete"

format:
	@echo "Formatting frontend code..."
	$(BUN)x biome format --write .
	@echo "Formatting Rust code..."
	cd $(BACKEND_DIR); cargo fmt
	@echo "Format complete"

typecheck:
	@echo "Running TypeScript type checking..."
	cd $(DESKTOP_DIR); $(BUN) run typecheck
	@echo "Type check passed"

test:
	@echo "Running Rust tests..."
	cd $(BACKEND_DIR); cargo test
	@echo "Running frontend tests..."
	cd $(DESKTOP_DIR); $(BUN) test
	@echo "Tests complete"
else
lint:
	@echo "Linting frontend code..."
	@$(BUN)x biome check .
	@echo "Linting Rust code..."
	@cd $(BACKEND_DIR) && cargo clippy -- -D warnings
	@echo "Lint complete"

lint-fix:
	@echo "Fixing frontend lint issues..."
	@$(BUN)x biome check --write .
	@echo "Lint fix complete"

format:
	@echo "Formatting frontend code..."
	@$(BUN)x biome format --write .
	@echo "Formatting Rust code..."
	@cd $(BACKEND_DIR) && cargo fmt
	@echo "Format complete"

typecheck:
	@echo "Running TypeScript type checking..."
	@cd $(DESKTOP_DIR) && $(BUN) run typecheck
	@echo "Type check passed"

test:
	@echo "Running Rust tests..."
	@cd $(BACKEND_DIR) && cargo test
	@echo "Running frontend tests..."
	@cd $(DESKTOP_DIR) && $(BUN) test
	@echo "Tests complete"
endif

# -------------
# Versioning
# -------------

ifeq ($(DETECTED_OS),windows)
version:
ifndef V
	@echo "Current version:"
	@cd $(BACKEND_DIR); (Select-String -Path Cargo.toml -Pattern '^version = "(.+)"').Matches.Groups[1].Value
else
	@echo "Updating version to $(V)..."
	@(Get-Content $(BACKEND_DIR)\Cargo.toml -Raw) -replace '(?m)^version = ".*"', 'version = "$(V)"' | Set-Content $(BACKEND_DIR)\Cargo.toml -NoNewline
	@(Get-Content $(BACKEND_DIR)\tauri.conf.json -Raw) -replace '"version": ".*"', '"version": "$(V)"' | Set-Content $(BACKEND_DIR)\tauri.conf.json -NoNewline
	@(Get-Content $(DESKTOP_DIR)\package.json -Raw) -replace '"version": ".*"', '"version": "$(V)"' | Set-Content $(DESKTOP_DIR)\package.json -NoNewline
	@(Get-Content package.json -Raw) -replace '"version": ".*"', '"version": "$(V)"' | Set-Content package.json -NoNewline
	@echo "  -> $(BACKEND_DIR)/Cargo.toml"
	@echo "  -> $(BACKEND_DIR)/tauri.conf.json"
	@echo "  -> $(DESKTOP_DIR)/package.json"
	@echo "  -> package.json (root)"
	@echo ""
	@echo "Version updated to $(V)"
endif
else
version:
ifndef V
	@echo "Current version: $$(grep '^version = ' $(BACKEND_DIR)/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')"
else
	@echo "Updating version to $(V)..."
	@$(SED_INPLACE) 's/^version = ".*"/version = "$(V)"/' $(BACKEND_DIR)/Cargo.toml
	@$(SED_INPLACE) 's/"version": ".*"/"version": "$(V)"/' $(BACKEND_DIR)/tauri.conf.json
	@$(SED_INPLACE) 's/"version": ".*"/"version": "$(V)"/' $(DESKTOP_DIR)/package.json
	@$(SED_INPLACE) 's/"version": ".*"/"version": "$(V)"/' package.json
	@echo "  -> $(BACKEND_DIR)/Cargo.toml"
	@echo "  -> $(BACKEND_DIR)/tauri.conf.json"
	@echo "  -> $(DESKTOP_DIR)/package.json"
	@echo "  -> package.json (root)"
	@echo ""
	@echo "Version updated to $(V)"
endif
endif

# -------------
# Maintenance
# -------------

ifeq ($(DETECTED_OS),windows)
clean:
	@echo "Cleaning build artifacts..."
	if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
	if (Test-Path $(FRONTEND_DIR)\dist) { Remove-Item -Recurse -Force $(FRONTEND_DIR)\dist }
	if (Test-Path target) { Remove-Item -Recurse -Force target }
	@echo "Cleanup complete"
else
clean:
	@echo "Cleaning build artifacts..."
	@$(RM) node_modules
	@$(RM) $(FRONTEND_DIR)/dist
	@$(RM) target
	@echo "Cleanup complete"
endif

.DEFAULT_GOAL := help
