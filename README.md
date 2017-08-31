## luna-lang

Typed version of Moon-lang. Candidate AST:

```haskell
data Term
  = App Term Term -- application
  | Lam Term Term -- linear functions
  | All Term Term -- dependent types
  | Let Term Term -- performs duplication
  | Fix Term      -- recursive types
  | Box Term      -- marks duplicable terms
  | Set Nat       -- type of types
  | Var Nat       -- substitution
```

It is basically [https://github.com/Gabriel439/Haskell-Morte-Library](morte) with linear functions and fixed points. This possibly solves some foundamental problems that Morte (CoC) has, in particular not being able to express pattern matching, large elims and induction nativelly.
