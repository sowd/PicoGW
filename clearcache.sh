find ./ -name "localstorage.json" -exec rm {} \;
rm ./v1/plugins/admin/settings.json
rm ./clients/.key
rm -rf /v1/plugins/db/data
