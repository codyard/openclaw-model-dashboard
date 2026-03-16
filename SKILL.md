# openclaw-model-dashboard Skill

## Introduction

openclaw-model-dashboard is a skill designed for the openclaw ecosystem, supporting model management, usage export, and model save API service.


## Features

- Install skill and dependencies (`install`)
- Export model usage (`export-usage`)
- Start model save API service (`save-api`)
- Automatically configure nginx virtual directory (`setup-nginx`)

## Usage


### Command Line

```sh
node index.js install        # Install skill dependencies and check nginx
node index.js export-usage   # Export model usage
node index.js save-api       # Start model save API service
node index.js setup-nginx    # Automatically configure nginx virtual directory /models-manager
```


### openclaw agent invocation

```sh
openclaw agent run-skill openclaw-model-dashboard install
openclaw agent run-skill openclaw-model-dashboard export-usage
openclaw agent run-skill openclaw-model-dashboard save-api
openclaw agent run-skill openclaw-model-dashboard setup-nginx
```


## Parameters

- install: No parameters, automatically installs Node.js dependencies and checks nginx
- export-usage: No parameters, directly exports model usage
- save-api: No parameters, directly starts the API service
- setup-nginx: No parameters, automatically detects nginx and generates /models-manager virtual directory config. Requires permission to write to /etc/nginx/conf.d/ and reload nginx (sudo recommended)

## Dependencies

- Node.js 18+
- .mjs scripts in the scripts/ directory
- nginx must be installed on the system

## Maintainer

- Gang
