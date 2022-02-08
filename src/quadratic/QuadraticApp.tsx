import QuadraticUI from "../ui/QuadraticUI";
import QuadraticGrid from "../core/gridGL/QuadraticGrid";
import { RecoilRoot } from "recoil";
import { MemoryRouter } from "react-router-dom";

interface QuadraticAppProps {
  isLoading: boolean;
  setIsLoading: Function;
}

export default function QuadraticApp(props: QuadraticAppProps) {
  return (
    <RecoilRoot>
      <MemoryRouter>
        {/* Provider of WebGL Canvas and Quadratic Grid */}
        <QuadraticGrid></QuadraticGrid>
        {/* Provider of All React UI Components */}
        <QuadraticUI></QuadraticUI>
      </MemoryRouter>
    </RecoilRoot>
  );
}
