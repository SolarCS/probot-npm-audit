# npm-audit

> A GitHub App built with [Probot](https://github.com/probot/probot) that A Probot app to run npm audit for security audits

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t npm-audit .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> npm-audit
```

## Contributing

If you have suggestions for how npm-audit could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2021 Darrell Agee <darrellagee12@gmail.com>
