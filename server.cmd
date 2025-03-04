taskkill /FI "WINDOWTITLE eq next-server *"

start cmd /k "TITLE nextjs-smart-home & git pull & npm install & npm run build & npm run start"