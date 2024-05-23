# Ultimate Dominion

Ultimate Dominion is a text-based MMORPG built on the MUD engine.

## Getting Started

### Requirements

- [Node.js v18.](https://nodejs.org/en/download/package-manager) Note that version 18 is required. We do not support older or newer versions at the moment.
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [pnpm, at least version 8](https://pnpm.io/)

### Steps

1. Install dependencies:

```bash
pnpm install
```

2. Create an env file in the client directory

```bash
cd packages/client cp .env.sample .env
```

3. Return to the root directory

```bash
cd ../..
```

4. Create an env file in the contracts directory

```bash
cd packages/contracts cp .env.sample .env
```

5. Return to the root directory

```bash
cd ../..
```

6. Run dev server

```bash
pnpm dev
```

## MUD

This game is built off of the MUD engine. Check their docs [here](https://mud.dev/introduction).
