import QuadraticUI from "../ui/QuadraticUI";
import QuadraticGrid from "../core/gridGL/QuadraticGrid";
import { RecoilRoot } from "recoil";
import { MemoryRouter } from "react-router-dom";
import { useLoading } from "../contexts/LoadingContext";
import { QuadraticLoading } from "../ui/QuadtraticLoading";

export default function QuadraticApp() {
  const { loading } = useLoading();

  return (
    <RecoilRoot>
      <MemoryRouter>
        {/* Provider of WebGL Canvas and Quadratic Grid */}
        <QuadraticGrid></QuadraticGrid>
        {/* Provider of All React UI Components */}
        <QuadraticUI></QuadraticUI>
        {/* Loading screen */}
        {loading && <QuadraticLoading></QuadraticLoading>}
      </MemoryRouter>
    </RecoilRoot>
  );
}
