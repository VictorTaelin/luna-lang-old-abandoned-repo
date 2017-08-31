const APP = 0, LAM = 1, ALL = 2, LET = 3,
      FIX = 4, BOX = 5, SET = 6, VAR = 7;

function AppF(fun, arg) {
  this.ctr = APP;
  this.fun = fun;
  this.arg = arg;
}

function LamF(nam, typ, bod) {
  this.ctr = LAM;
  this.nam = nam;
  this.typ = typ;
  this.bod = bod;
}

function AllF(nam, typ, bod) {
  this.ctr = ALL;
  this.nam = nam;
  this.typ = typ;
  this.bod = bod;
}

function FixF(nam, bod) {
  this.ctr = FIX;
  this.nam = nam;
  this.bod = bod;
}

function SetF(lvl) {
  this.ctr = SET;
  this.lvl = lvl;
}

function VarF(nam) {
  this.ctr = VAR;
  this.nam = nam;
}

function ErrF(err, bod) {
  this.ctr = ERR;
}

const App = (fun, arg) => new AppF(fun, arg);
const Lam = (nam, typ, bod) => new LamF(nam ,typ, bod);
const All = (nam, typ, bod) => new AllF(nam, typ, bod);
const Fix = (nam, bod) => new FixF(nam, bod);
const Set = (lvl) => new SetF(lvl);
const Var = (idx) => new VarF(idx);

const equals = (a, b, d) => {
  if (a.ctr === FIX && b.ctr !== FIX)
    return equals(a.ter(a), b, d);

  if (a.ctr !== FIX && b.ctr === FIX)
    return equals(a, b.ter(b), d);

  if (a.ctr === VAR)
    return a.ctr === b.ctr && a.nam === b.nam;

  if (a.ctr === APP)
    return a.ctr === b.ctr && equals(a.fun, b.fun, d) && equals(a.arg, b.arg, d);

  if (a.ctr === LAM)
    return a.ctr === b.ctr && equals(a.typ, b.typ, d) && equals(a.bod(Var(d)), b.bod(Var(d)), d + 1);

  if (a.ctr === ALL)
    return a.ctr === b.ctr && equals(a.typ, b.typ, d) && equals(a.bod(Var(d)), b.bod(Var(d)), d + 1);

  if (a.ctr === SET)
    return a.ctr === b.ctr && a.lvl === b.lvl;

  return false;
};

const unquote = (term, ctx, level) => {
  switch (term.ctr) {
    case APP:
      const fv = unquote(term.fun, ctx, 0);
      const ft = unquote(term.fun, ctx, 1);
      const xv = unquote(term.arg, ctx, 0);
      const xt = unquote(term.arg, ctx, 1);

      if (ft.ctr === FIX)
        ft = ft.ter(ft);

      if (fv.ctr === FIX)
        fv = fv.ter(fv);

      if (ft.ctr !== ALL)
        throw "NonFunctionApplication";

      if (!equals(ft.typ, xt, 0))
        throw "TypeMismatch";

      return level === 1
        ? (ft.ctr === ALL ? ft.bod(xv) : App(ft, xt))
        : (fv.ctr === LAM ? fv.bod(xv) : App(fv, xv));

    case LAM:
    case ALL:
      const typv = unquote(term.typ, ctx, 0);
      const typt = unquote(term.typ, ctx, 1);
      const bodv = v => unquote(term.bod, [[term.nam, v, typv], ctx], 0);
      const bodt = v => unquote(term.bod, [[term.nam, v, typv], ctx], 1);

      return level === 1
        ? (term.ctr === LAM ? All(term.nam, typv, bodt) : Set(0))
        : (term.ctr === LAM ? Lam(term.nam, typv, bodv) : All(term.nam, typv, bodv));

    case FIX:
      return level === 1 
        ? Fix(term.nam, v => unquote(term.ter, [[term.nam, v, Set], ctx], 1))
        : Fix(term.nam, v => unquote(term.ter, [[term.nam, v, Set], ctx], 0));

    case VAR:
      const def = find(def => def[0] === term.nam, ctx);
      if (def) {
        return def[1 + level];
      } else {
        throw "Unbound Variable";
      }

    case SET:
      return Set(term.lvl + level);
  }
};

const quote = (term) => {
  switch (term.ctr) {
    case VAR: return Var(term.nam);
    case APP: return App(quote(term.fun), quote(term.arg));
    case LAM: return Lam(term.nam, quote(term.typ), quote(term.bod(Var(term.nam))));
    case ALL: return All(term.nam, quote(term.typ), quote(term.bod(Var(term.nam))));
    case FIX: return Fix(term.nam, quote(term.ter(Var(term.nam))));
    case SET: return Set(term.lvl);
  }
};

const parse = code => {
  let s = "(" + code + ")";
  let i = 0;
  const parse = () => {
    let parses = [];
    while (s[i]) {
      while (/\s/.test(s[i])) {
        ++i;
      }
      if (/Type/.test(s.slice(i, i + 4))) {
        i += 4;
        parses.push(Set(0));
      } else if (/\w/.test(s[i])) {
        let word = "";
        while (s[i] && /\w/.test(s[i])) {
          word += s[i++];
        }
        parses.push(Var(word));
      } else if (/\(/.test(s[i])) {
        const term = (++i, parse());
        parses.push((++i, term));
      } else if (/(=>|->)/.test(s.slice(i,i+2))) {
        const name = parses.length > 1 ? parses.pop().nam : "";
        const type = parses.pop();
        parses.push(s.slice(i, i += 2) === "=>"
          ? Lam(name, type, parse())
          : All(name, type, parse()));
      } else if (/\)/.test(s[i])) {
        break;
      }
    }
    return parses.reduce((parse, result) => App(parse, result));
  };
  return parse();
};

const stringify = term => {
  const wrapIf = ([tag, str, wrap], cond) =>
    (cond(tag) ? wrap : (x => x))(str);
    
  const go = term => {
    switch (term.ctr) {
      case APP:
        const fun = wrapIf(go(term.fun), tag => !/App/.test(tag));
        const arg = wrapIf(go(term.arg), tag => true);
        return [
          term.ctr,
          fun + " " + arg,
          x => "(" + x + ")"
        ];
      case LAM:
      case ALL:
        const name = term.nam;
        const type = wrapIf(go(term.typ), tag => true);
        const body = wrapIf(go(term.bod), tag => tag !== LAM && tag !== ALL);
        const spac = name.length > 0 ? " " : "";
        const arrw = term.ctr === LAM ? " => " : " -> ";
        return [
          term.ctr,
          type + spac + name + arrw + body,
          x => "(" + x + ")"
        ];
      case SET:
        return [
          term.ctr,
          "Type" + (term.lvl > 0 ? term.lvl : ""),
          x => x
        ];
      case VAR:
        return [
          term.ctr,
          term.nam,
          x => x
        ];
    }
  };

  return wrapIf(go(term), tag => tag !== LAM && tag !== ALL && tag !== APP);
};

const find = (fn, list) =>
  !list
    ? null
    : fn(list[0])
      ? list[0]
      : find(fn, list[1]);

const print = x => console.log(stringify(parse(x)));

const code = `
  Type Nat => (Nat -> Nat) Succ => Nat Zero => (Succ (Succ Zero))
`;

//console.log(parse(code));
console.log(stringify(quote(unquote(parse(code), null, 1))));
//print(code);
