export class Lifetime extends AsyncDisposableStack {
  using(resource: AsyncDisposable) {
    this.use(resource);
    return this;
  }
}
