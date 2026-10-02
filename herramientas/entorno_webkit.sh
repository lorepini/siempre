# WebKit (el motor de Safari) necesita librerías que esta máquina no tiene
# instaladas y aquí no hay permisos de administrador. Se descargaron a mano a
# una carpeta aparte; esto le dice dónde encontrarlas.
#   uso:  source herramientas/entorno_webkit.sh && python3 herramientas/probar_iphone.py
BASE="${PW_LIBS:-/tmp/claude-1000/-mnt-c-Users-pinil-OneDrive-Documentos-Lorena-Pinillos-AP-WEB/6a845fc8-c971-4762-9991-1d53b19cb6dc/scratchpad/libs/root}"
L="$BASE/usr/lib/x86_64-linux-gnu"
export PW_EXTRA_LIB_PATH="$L:$BASE/usr/lib"
export LD_LIBRARY_PATH="$L:$BASE/usr/lib"
export GST_PLUGIN_SYSTEM_PATH="$L/gstreamer-1.0"
export GIO_EXTRA_MODULES="$L/gio/modules"
export GIO_MODULE_DIR="$L/gio/modules"
export GIO_USE_TLS=gnutls
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
