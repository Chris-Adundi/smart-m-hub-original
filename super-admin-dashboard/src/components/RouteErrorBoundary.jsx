import { Component } from "react";

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Route error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: 24, color: "#991b1b" }}>
          <strong>Page failed to load</strong>
          <p>{this.state.error?.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
