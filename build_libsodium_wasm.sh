#!/usr/bin/env bash
set -e

echo "🚀 Starting libsodium WASM build"

# --- Configurable paths ---
LIBSODIUM_DIR="$(pwd)/external/libsodium"
PREFIX_DIR="$LIBSODIUM_DIR/dist"

# --- Check prerequisites ---
if ! command -v emcc >/dev/null 2>&1; then
  echo "❌ Emscripten not found. Run: source ./emsdk_env.sh"
  exit 1
fi

echo "🧠 Using Emscripten compiler: $(which emcc)"

# --- Enter libsodium directory ---
cd "$LIBSODIUM_DIR"

# --- Bootstrap autotools if needed ---
if [ ! -f configure ]; then
  echo "🛠️  Bootstrapping autotools (generating configure script)..."
  if command -v glibtoolize >/dev/null 2>&1; then
    glibtoolize
  else
    libtoolize
  fi
  aclocal
  autoconf
  automake --add-missing
else
  echo "✅ Autotools already bootstrapped"
fi

# --- Clean previous build if any ---
echo "🧹 Cleaning previous builds..."
rm -rf "$PREFIX_DIR"
mkdir -p "$PREFIX_DIR"

# --- Configure for WASM build ---
echo "⚙️  Configuring libsodium for WebAssembly..."
emconfigure ./configure \
  --disable-shared \
  --disable-ssp \
  --enable-minimal \
  --host=none \
  --prefix="$PREFIX_DIR"

# --- Build and install ---
echo "🔨 Building and installing to $PREFIX_DIR ..."
emmake make install -j$(nproc)

# --- Confirm output ---
echo "✅ Build complete!"
echo "📂 Headers: $PREFIX_DIR/include/sodium/"
echo "📦 Static lib: $PREFIX_DIR/lib/libsodium.a"

# --- Verify library exists ---
if [ -f "$PREFIX_DIR/lib/libsodium.a" ]; then
  echo "🎯 libsodium.a successfully built for WASM!"
else
  echo "❌ libsodium.a missing — build failed."
  exit 1
fi

# --- Done ---
cd - >/dev/null
echo "🏁 libsodium WebAssembly build ready."
