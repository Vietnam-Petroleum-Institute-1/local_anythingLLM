#!/bin/bash

# # Start MySQL server
# service mysql start
# # Wait for MySQL to be ready
# echo "Waiting for MySQL to be ready..."
# until mysqladmin ping -h "127.0.0.1" -P 3306 -u root -p MyStr0ngP@ssw0rd! --silent; do
#   sleep 2
# done


echo "MySQL is up and running!"
{
  cd /app/server/ &&
    npx prisma generate --schema=./prisma/schema.prisma &&
    npx prisma migrate deploy --schema=./prisma/schema.prisma &&
    node /app/server/index.js
} &
{ node /app/collector/index.js; } &
wait -n
exit $?
