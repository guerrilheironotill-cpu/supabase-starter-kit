#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${1:-/home/deploy/apps/arteno}"
PM2_APP="${2:-arteno-staging}"

APP_DIR="$(realpath "$APP_DIR")"
case "$APP_DIR" in
  /home/deploy/apps/*) ;;
  *) echo "Diretório de aplicação não permitido: $APP_DIR" >&2; exit 1 ;;
esac

BUILD_DIR="$(mktemp -d "$APP_DIR/.deploy-build.XXXXXX")"
PREVIOUS_OUTPUT="$APP_DIR/.output-previous"

cleanup() {
  if [[ -n "${BUILD_DIR:-}" && "$BUILD_DIR" == "$APP_DIR"/.deploy-build.* ]]; then
    rm -rf -- "$BUILD_DIR"
  fi
}
trap cleanup EXIT

cd "$APP_DIR"
git archive HEAD | tar -x -C "$BUILD_DIR"
if [[ -f .env ]]; then
  cp .env "$BUILD_DIR/.env"
fi

cd "$BUILD_DIR"
npm ci
npm run build

# Mantém os chunks estáticos da versão anterior. Assim, uma aba que já estava
# aberta antes do deploy ainda consegue concluir uma navegação sem receber 404.
if [[ -d "$APP_DIR/.output/public/assets" ]]; then
  cp -an "$APP_DIR/.output/public/assets/." "$BUILD_DIR/.output/public/assets/"
fi

cd "$APP_DIR"
pm2 stop "$PM2_APP"

if [[ -d "$PREVIOUS_OUTPUT" ]]; then
  rm -rf -- "$PREVIOUS_OUTPUT"
fi
if [[ -d .output ]]; then
  mv .output "$PREVIOUS_OUTPUT"
fi

mv "$BUILD_DIR/.output" .output

if ! pm2 start "$PM2_APP" --update-env; then
  rm -rf -- .output
  if [[ -d "$PREVIOUS_OUTPUT" ]]; then
    mv "$PREVIOUS_OUTPUT" .output
    pm2 start "$PM2_APP" --update-env
  fi
  exit 1
fi

pm2 status "$PM2_APP"
