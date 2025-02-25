# Contributing to Ultimate Dominion

Thank you for your interest in contributing to Ultimate Dominion! This document provides guidelines and instructions for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Documentation Guidelines](#documentation-guidelines)
- [Community](#community)

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. We expect all contributors to adhere to these guidelines to maintain a welcoming and inclusive community.

## Getting Started

1. **Fork the Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ultimate-dominion.git
   cd ultimate-dominion
   pnpm install
   ```

2. **Set Up Development Environment**
   - Follow the setup instructions in our [Implementation Plan](implementation_plan.md)
   - Copy `.env.sample` files and configure your environment
   - Ensure all tests pass before making changes

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Process

1. **Code Style**
   - Follow TypeScript best practices
   - Use ESLint and Prettier configurations
   - Maintain consistent naming conventions
   - Write clear, self-documenting code

2. **Testing**
   - Write unit tests for new features
   - Ensure all tests pass locally
   - Add integration tests where necessary
   - Test across different environments

3. **Documentation**
   - Follow our [documentation guidelines](documentation_review_checklist.md)
   - Update relevant documentation
   - Add JSDoc comments for new functions
   - Include examples where helpful

## Pull Request Process

1. **Before Submitting**
   - Update documentation following our checklist
   - Ensure all tests pass
   - Update relevant examples
   - Add changelog entry

2. **PR Requirements**
   - Clear description of changes
   - Link to related issues
   - Screenshots/videos for UI changes
   - Test coverage for new features

3. **Review Process**
   - Two approvals required
   - All CI checks must pass
   - Documentation must be updated
   - No merge conflicts

## Documentation Guidelines

Follow our documentation style:
- Use simple, clear language
- Include real-world analogies
- Provide code examples
- Add ASCII diagrams where helpful
- Cross-reference related docs

## Community

- Join our Discord server for discussions
- Check our GitHub Issues for ways to contribute
- Attend our community calls
- Follow our blog for updates

## Getting Help

- Check our [FAQ](docs/FAQ.md)
- Ask in Discord
- Open a GitHub Discussion
- Email: support@ultimate-dominion.com
