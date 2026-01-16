import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import App from "@/App"

describe("AppLayout full-width behavior", () => {
  it("should render page content directly inside the global layout container when layout is full-width", () => {
    render(
      <MemoryRouter initialEntries={["/runs/new"]}>
        <App />
      </MemoryRouter>
    )

    // Elemento que identifica conteúdo da página
    const heading = screen.getByText("New Validation Run")
    expect(heading).toBeTruthy()

    // O container imediato do conteúdo deve ser o layout,
    // não um wrapper adicional criado pela página
    const pageContainer = heading.closest("div")
    expect(pageContainer).toBeTruthy()

    const parentOfContainer = pageContainer?.parentElement
    expect(parentOfContainer).toBeTruthy()

    // Após a implementação, o conteúdo da página não deve
    // estar encapsulado em um wrapper extra criado pela própria página
    expect(parentOfContainer?.getAttribute("data-page-wrapper")).toBeNull()
  })

  it("should fail when the page wraps its content inside a local centered container", () => {
    render(
      <MemoryRouter initialEntries={["/runs/new"]}>
        <App />
      </MemoryRouter>
    )

    const heading = screen.getByText("New Validation Run")
    expect(heading).toBeTruthy()

    const pageContainer = heading.closest("div")
    expect(pageContainer).toBeTruthy()

    // No estado anterior (baseRef), este wrapper existe
    // e faz com que o teste falhe
    expect(pageContainer?.className).not.toContain("max-w")
  })
})
