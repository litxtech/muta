/**
 * StyleSheet.create({ ... }) → StyleSheet.create(() => ({ ... }))
 * + PascalCase bilesenlere useTemayaAboneOl() enjekte eder.
 */
const nodePath = require('path');

module.exports = function tamusoTemaBabel({ types: t }) {
  const HOOK = 'useTemayaAboneOl';

  function hookSource(filename) {
    const target = nodePath.join(__dirname, 'useTemayaAboneOl');
    let rel = nodePath.relative(nodePath.dirname(filename), target).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel;
  }

  function skipFile(filename) {
    if (!filename) return true;
    const n = filename.replace(/\\/g, '/');
    if (n.includes('node_modules')) return true;
    if (n.includes('/tasarim-sistemi/tema/')) return true;
    if (!n.endsWith('.tsx') && !n.endsWith('.ts') && !n.endsWith('.jsx') && !n.endsWith('.js')) {
      return true;
    }
    return false;
  }

  function isPascal(name) {
    return typeof name === 'string' && /^[A-Z]/.test(name);
  }

  function isMemoCall(path) {
    if (!path || !path.isCallExpression()) return false;
    const callee = path.get("callee");
    if (callee.isIdentifier({ name: "memo" })) return true;
    return (
      callee.isMemberExpression() &&
      callee.get("property").isIdentifier({ name: "memo" })
    );
  }

  function componentName(path) {
    const node = path.node;
    if (node.id && t.isIdentifier(node.id)) return node.id.name;
    if (path.parent && t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
      return path.parent.id.name;
    }
    if (path.parent && t.isExportDefaultDeclaration(path.parent)) {
      return "DefaultExport";
    }
    if (isMemoCall(path.parentPath) && path.parentPath.parent && t.isVariableDeclarator(path.parentPath.parent) && t.isIdentifier(path.parentPath.parent.id)) {
      return path.parentPath.parent.id.name;
    }
    return null;
  }

  function isTopLevel(path) {
    const p = path.parentPath;
    if (!p) return false;
    if (p.isProgram()) return true;
    if (p.isExportNamedDeclaration() || p.isExportDefaultDeclaration()) return true;
    if (
      p.isVariableDeclarator() &&
      p.parentPath &&
      (p.parentPath.parentPath?.isProgram() ||
        p.parentPath.parentPath?.isExportNamedDeclaration())
    ) {
      return true;
    }
    if (isMemoCall(p)) {
      const decl = p.parentPath;
      if (decl && decl.isVariableDeclarator()) {
        const varDecl = decl.parentPath;
        return !!(
          varDecl &&
          (varDecl.parentPath?.isProgram() ||
            varDecl.parentPath?.isExportNamedDeclaration())
        );
      }
      if (p.parentPath && p.parentPath.isExportDefaultDeclaration()) return true;
    }
    return false;
  }

  function hasJsx(path) {
    let found = false;
    path.traverse({
      JSXElement() {
        found = true;
      },
      JSXFragment() {
        found = true;
      },
    });
    return found;
  }

  function alreadyHooked(path) {
    let found = false;
    const body = path.node.body;
    if (!t.isBlockStatement(body)) return false;
    for (const stmt of body.body) {
      if (
        t.isExpressionStatement(stmt) &&
        t.isCallExpression(stmt.expression) &&
        t.isIdentifier(stmt.expression.callee, { name: HOOK })
      ) {
        found = true;
        break;
      }
    }
    return found;
  }

  function ensureImport(program, filename) {
    const source = hookSource(filename);
    const body = program.node.body;
    const exists = body.some(
      (n) =>
        t.isImportDeclaration(n) &&
        n.source.value === source,
    );
    if (exists) return;
    const decl = t.importDeclaration(
      [t.importSpecifier(t.identifier(HOOK), t.identifier(HOOK))],
      t.stringLiteral(source),
    );
    const firstNonImport = body.findIndex((n) => !t.isImportDeclaration(n));
    if (firstNonImport === -1) body.unshift(decl);
    else body.splice(firstNonImport, 0, decl);
  }

  function wrapBodyWithHook(path, program, filename) {
    if (alreadyHooked(path)) return;
    const body = path.node.body;
    const call = t.expressionStatement(t.callExpression(t.identifier(HOOK), []));
    if (t.isBlockStatement(body)) {
      body.body.unshift(call);
    } else {
      path.node.body = t.blockStatement([
        call,
        t.returnStatement(body),
      ]);
    }
    ensureImport(program, filename);
  }

  return {
    name: 'tamuso-tema',
    visitor: {
      CallExpression(path, state) {
        if (state.filename && skipFile(state.filename)) return;
        const callee = path.get('callee');
        if (!callee.isMemberExpression()) return;
        if (!callee.get('object').isIdentifier({ name: 'StyleSheet' })) return;
        if (!callee.get('property').isIdentifier({ name: 'create' })) return;
        const arg = path.node.arguments[0];
        if (!arg) return;
        if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) return;
        path.node.arguments[0] = t.arrowFunctionExpression([], arg);
      },
      FunctionDeclaration(path, state) {
        if (skipFile(state.filename)) return;
        if (!isTopLevel(path)) return;
        const name = componentName(path);
        if (!isPascal(name) && name !== 'DefaultExport') return;
        if (!hasJsx(path)) return;
        const program = path.findParent((p) => p.isProgram());
        if (!program) return;
        wrapBodyWithHook(path, program, state.filename);
      },
      FunctionExpression(path, state) {
        if (skipFile(state.filename)) return;
        if (!isTopLevel(path)) return;
        const name = componentName(path);
        if (!isPascal(name) && name !== 'DefaultExport') return;
        if (!hasJsx(path)) return;
        const program = path.findParent((p) => p.isProgram());
        if (!program) return;
        wrapBodyWithHook(path, program, state.filename);
      },
      ArrowFunctionExpression(path, state) {
        if (skipFile(state.filename)) return;
        if (!isTopLevel(path)) return;
        const name = componentName(path);
        if (!isPascal(name) && name !== 'DefaultExport') return;
        if (!hasJsx(path)) return;
        const program = path.findParent((p) => p.isProgram());
        if (!program) return;
        wrapBodyWithHook(path, program, state.filename);
      },
    },
  };
};
