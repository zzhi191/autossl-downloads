const { execFileSync } = require('child_process')
const fs = require('fs/promises')
const path = require('path')

function getPackageRelativePath(projectDir, dependencyPath) {
  const nodeModulesMarker = `${path.sep}node_modules${path.sep}`
  const markerIndex = dependencyPath.indexOf(nodeModulesMarker)
  if (markerIndex === -1) return null

  return path.relative(
    path.join(projectDir, 'node_modules'),
    dependencyPath,
  )
}

function isNestedInsideSelectedPackage(dependencyPath, selectedPaths) {
  return selectedPaths.some((selectedPath) =>
    dependencyPath.startsWith(`${selectedPath}${path.sep}node_modules${path.sep}`),
  )
}

async function copyProductionDependency(projectDir, resourcesDir, dependencyPath) {
  const relativePath = getPackageRelativePath(projectDir, dependencyPath)
  if (!relativePath || relativePath.startsWith('..')) return

  const targetPath = path.join(resourcesDir, 'node_modules', relativePath)
  await fs.rm(targetPath, { recursive: true, force: true })
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.cp(dependencyPath, targetPath, {
    recursive: true,
    dereference: false,
    filter: (source) => !source.includes(`${path.sep}.cache${path.sep}`),
  })
}

module.exports = async function afterPack(context) {
  const projectDir = context.packager.projectDir
  const resourcesDir = context.packager.getResourcesDir(context.appOutDir)

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const spawnOptions =
    process.platform === 'win32'
      ? { cwd: projectDir, encoding: 'utf8', shell: true }
      : { cwd: projectDir, encoding: 'utf8' }
  const dependencyList = execFileSync(
    npmBin,
    ['ls', '--omit=dev', '--parseable', '--all'],
    spawnOptions,
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== projectDir)
    .sort((left, right) => left.length - right.length)

  const selectedPaths = []
  for (const dependencyPath of dependencyList) {
    if (!isNestedInsideSelectedPackage(dependencyPath, selectedPaths)) {
      selectedPaths.push(dependencyPath)
    }
  }

  await fs.rm(path.join(resourcesDir, 'node_modules'), {
    recursive: true,
    force: true,
  })

  for (const dependencyPath of selectedPaths) {
    await copyProductionDependency(projectDir, resourcesDir, dependencyPath)
  }

  console.log(
    `[AfterPack] Copied ${selectedPaths.length} production dependency packages to ${path.join(resourcesDir, 'node_modules')}`,
  )
}
