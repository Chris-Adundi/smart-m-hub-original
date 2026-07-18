import { Component } from "react";
import { ErrorState } from "@/components/ui/state";
import { reportFrontendError } from "@/services/frontendErrors";

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
    reportFrontendError(error, info, "main");
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="Page failed to load"
          detail={this.state.error?.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
