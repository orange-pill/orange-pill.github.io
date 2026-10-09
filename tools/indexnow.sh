#!/bin/sh
# Tells Bing, Yandex, Seznam, Naver and Yep that the pages in sitemap.xml are new or updated (IndexNow protocol).
# No account needed: the key file in the site root proves the site is ours. Run after a push, once the site is live.
#   sh tools/indexnow.sh
cd "$(dirname "$0")/.." || exit 1
HOST=orange-pill.github.io
KEY=$(basename "$(ls ./*.txt | grep -E '/[0-9a-f]{32}\.txt$' | head -1)" .txt)
URLS=$(grep -o '<loc>[^<]*</loc>' sitemap.xml | sed 's#</*loc>##g; s#.*#"&"#' | paste -sd, -)
curl -sS -w '\nHTTP %{http_code}\n' -X POST 'https://api.indexnow.org/indexnow' \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d "{\"host\":\"$HOST\",\"key\":\"$KEY\",\"keyLocation\":\"https://$HOST/$KEY.txt\",\"urlList\":[$URLS]}"
