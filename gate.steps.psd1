@{
    Schema   = 1
    Repo     = 'Churches'
    Workflow = '.github/workflows/main_crgolden-churches.yml'
    Settings = 'e2e/e2e-settings.json'
    Sonar    = @{ ProjectKey = 'crgolden_Churches' }
    Probe    = @{
        Kind                = 'node'
        Roots               = @{ 'src/' = 'vitest'; 'e2e/' = 'playwright' }
        PlaywrightArguments = @('--project=e2e', '--no-deps')
    }
    Steps    = @(
        @{ Name = 'Decide whether this push ships'; Delivery = $true }
        @{ Name = 'Install npm dependencies'; NodeInstall = @('tsc', 'vitest'); Inputs = @('*'); Always = $true }
        @{
            Name   = 'Lint'
            Tier   = 'Fast'
            Run    = @('npm', 'run', 'lint')
            Needs  = @('Install npm dependencies')
            Inputs = @('src/*', '*.ts', '*.mts', '*.js', '*.mjs', '*.cjs', 'eslint-sonar.rules.json', 'angular.json', 'tsconfig*.json', 'package.json', 'package-lock.json')
        }
        @{
            Name   = 'Type-check E2E specs'
            Tier   = 'Fast'
            Run    = @('npm', 'run', 'typecheck:e2e')
            Needs  = @('Install npm dependencies')
            Inputs = @('src/*', 'e2e/*', 'integration/*', 'playwright.config.ts', 'tsconfig*.json', 'package.json', 'package-lock.json')
        }
        @{
            Name   = 'Type-check unit specs'
            Tier   = 'Fast'
            Run    = @('npm', 'run', 'typecheck:spec')
            Needs  = @('Install npm dependencies')
            Inputs = @('src/*', 'tsconfig*.json', 'package.json', 'package-lock.json')
        }
        @{
            Name   = 'Lint stylesheets'
            Tier   = 'Fast'
            Run    = @('npm', 'run', 'lint:css')
            Needs  = @('Install npm dependencies')
            Inputs = @('src/*', 'stylelint.config.mjs', 'package.json', 'package-lock.json', 'tools/stylelint/*')
        }
        @{
            Name     = 'Audit dependencies (fails on high or critical)'
            Run      = @('npm', 'run', 'audit')
            Needs    = @('Install npm dependencies')
            Inputs   = @('package.json', 'package-lock.json')
            Volatile = $true
        }
        @{ Name = 'Get Playwright version'; Delivery = $true }
        @{
            Name              = 'Install Playwright browsers'
            PlaywrightInstall = @{ DryRun = @('npx', 'playwright', 'install', '--dry-run', 'chromium'); Install = @('npm', 'run', 'playwright:install') }
            Needs             = @('Install npm dependencies')
            Inputs            = @('*')
            Always            = $true
        }
        @{
            Name   = 'Run unit tests with coverage'
            Run    = @('npm', 'run', 'test:coverage')
            Needs  = @('Install npm dependencies', 'Install Playwright browsers')
            Inputs = @('*', '!e2e/*', '!integration/*')
        }
        @{
            Name   = 'Fix LCOV paths for SonarQube'
            Run    = @('pwsh', '-NoProfile', '-File', 'scripts/gate/Repair-LcovPath.ps1')
            Needs  = @('Install npm dependencies', 'Install Playwright browsers')
            Inputs = @('*', '!e2e/*', '!integration/*')
        }
        @{
            Name   = 'Run E2E tests'
            Run    = @('npm', 'run', 'e2e')
            Remove = @('playwright-results.xml')
            Needs  = @('Install npm dependencies', 'Install Playwright browsers')
            Inputs = @('*', '!src/*.spec.ts')
        }
        @{
            Name   = 'Assert E2E executed at least its floor'
            Run    = @('pwsh', '-NoProfile', '-File', 'scripts/gate/Assert-E2eFloor.ps1')
            Needs  = @('Run E2E tests')
            Inputs = @('*', '!src/*.spec.ts')
        }
        @{
            Name           = 'Publish E2E scenario results'
            PublishCommand = @{ App = 'Churches'; Messages = '{setting:cucumberMessagesFile}' }
            Needs          = @('Run E2E tests')
            Inputs         = @('*')
        }
        @{
            Name   = 'Transfer-cache plant'
            Run    = @('pwsh', '-NoProfile', '-File', 'scripts/gate/Assert-TransferCachePlant.ps1', '-ReportPath', '{output}\churches-transfer-cache-plant.json')
            Needs  = @('Install npm dependencies', 'Install Playwright browsers')
            Inputs = @('*', '!src/*.spec.ts')
        }
        @{
            Name   = 'Check template classes against the built CSS'
            Run    = @('npm', 'run', 'lint:utilities')
            Needs  = @('Run E2E tests')
            Inputs = @('*')
        }
        @{
            Name   = 'SonarCloud analysis'
            Sonar  = 'scan'
            Run    = @(
                'sonar-scanner'
                '-Dsonar.projectKey={sonarProject}'
                '-Dsonar.organization=crgolden'
                '-Dsonar.host.url=https://sonarcloud.io'
                '-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info'
                '-Dsonar.exclusions=**/node_modules/**,**/*.d.ts,e2e/**,integration/**,.features-gen/**,instrumentation.mjs,**/*.spec.ts'
                '-Dsonar.tests=src'
                '-Dsonar.coverage.exclusions=e2e/**,integration/**,scripts/**,**/*.config.*,src/test-setup*.ts,gate.ps1,gate.steps.psd1,src/proxy.conf.js,src/environments/**,src/main.ts,src/main.server.ts,src/server.ts,src/app/app.routes.server.ts'
                '-Dsonar.test.inclusions=**/*.spec.ts'
                '-Dsonar.scanner.skipJreProvisioning=true'
                '-Dsonar.scm.use.blame.algorithm=GIT_NATIVE_BLAME'
                '-Dsonar.qualitygate.wait=true'
                '-Dsonar.branch.name={sonarBranch}'
            )
            Needs  = @('Install npm dependencies')
            Inputs = @('*')
        }
        @{ Name = 'Fail on open Sonar issues'; Sonar = 'issues'; Needs = @('SonarCloud analysis'); Inputs = @('*') }
        @{ Name = 'Build (production)'; Run = @('npm', 'run', 'build'); Needs = @('Install npm dependencies'); Inputs = @('*') }
        @{ Name = 'Prune devDependencies'; Delivery = $true }
        @{ Name = 'Assemble deployment package'; Delivery = $true }
        @{ Name = 'Verify App Service Node runtime matches the build'; Delivery = $true }
    )
}
