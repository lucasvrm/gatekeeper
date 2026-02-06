import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function OrquiTab() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Esquerdo: Workbench */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎨 Workbench
            </CardTitle>
            <CardDescription>
              IDE-like editor para tokens, brand, shell e componentes do Orqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>O Workbench permite editar:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Design tokens (cores, espaçamentos, tipografia)</li>
                <li>Brand identity (logo, favicon)</li>
                <li>App shell (header, sidebar, footer)</li>
                <li>Componentes e UI registry</li>
              </ul>
            </div>
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => window.open('/__orqui', '_blank')}
            >
              Abrir Workbench
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Card Direito: Page Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📄 Page Editor
            </CardTitle>
            <CardDescription>
              Editor visual drag-and-drop para construir páginas com componentes Orqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>O Page Editor oferece:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Drag-and-drop de componentes</li>
                <li>Edição visual de props e estilos</li>
                <li>Modo tree ou grid layout</li>
                <li>Gestão de variáveis user/external</li>
              </ul>
            </div>
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => window.open('/page-editor', '_blank')}
            >
              Abrir Page Editor
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
