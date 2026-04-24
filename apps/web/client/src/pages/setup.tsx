import { useState, useEffect } from "react";
import { useLocation } from "wouter";

interface SetupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  companyName: string;
}

interface PortConfig {
  apiPort: number;
  webPort: number;
}

export default function SetupPage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"ports" | "admin">("ports");

  const [ports, setPorts] = useState<PortConfig>({
    apiPort: 4000,
    webPort: 5000,
  });

  const [useCustomPorts, setUseCustomPorts] = useState(false);
  const [tempApiPort, setTempApiPort] = useState("4000");
  const [tempWebPort, setTempWebPort] = useState("5000");

  const [formData, setFormData] = useState<SetupFormData>({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    companyName: "",
  });

  // Check if setup is already complete
  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch("/api/setup/status");
      const data = await response.json();
      if (data.setupComplete) {
        navigate("/login");
      }
    } catch (err) {
      console.error("Error checking setup status:", err);
    }
  };

  const handlePortsSubmit = () => {
    setError(null);

    if (useCustomPorts) {
      const api = parseInt(tempApiPort);
      const web = parseInt(tempWebPort);

      if (isNaN(api) || isNaN(web) || api < 1024 || web < 1024) {
        setError("Puertos deben ser números >= 1024");
        return;
      }

      if (api === web) {
        setError("Los puertos no pueden ser iguales");
        return;
      }

      setPorts({ apiPort: api, webPort: web });
    }

    setStep("admin");
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.email || !formData.password || !formData.name) {
      setError("Todos los campos son requeridos");
      return;
    }

    if (formData.password.length < 8) {
      setError("Contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Email inválido");
      return;
    }

    setLoading(true);

    try {
      // 1. Save port configuration if custom
      if (useCustomPorts) {
        const portResponse = await fetch("/api/setup/ports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiPort: ports.apiPort,
            webPort: ports.webPort,
          }),
        });

        if (!portResponse.ok) {
          const errorData = await portResponse.json();
          throw new Error(
            errorData.message || "Error al guardar configuración de puertos"
          );
        }
      }

      // 2. Create admin user
      const response = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          companyName: formData.companyName || "Mi Empresa",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al crear administrador");
      }

      // 3. Mark setup as complete
      await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Setup complete, redirect to login
      navigate("/login");
    } catch (err: any) {
      setError(err.message || "Error durante la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pymeshub</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-6">
          Configuración Inicial
        </h2>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {step === "ports" ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">
              Configuración de Puertos
            </h3>

            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="portMode"
                  checked={!useCustomPorts}
                  onChange={() => setUseCustomPorts(false)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-gray-700">
                  Usar puertos predeterminados (4000/5000)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="portMode"
                  checked={useCustomPorts}
                  onChange={() => setUseCustomPorts(true)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-gray-700">
                  Configurar puertos personalizados
                </span>
              </label>

              {useCustomPorts && (
                <div className="space-y-3 mt-4 p-4 bg-gray-50 rounded">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Puerto API (debe ser {'>'} 1024):
                    </label>
                    <input
                      type="number"
                      value={tempApiPort}
                      onChange={(e) => setTempApiPort(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1024"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Puerto Web (debe ser {'>'} 1024):
                    </label>
                    <input
                      type="number"
                      value={tempWebPort}
                      onChange={(e) => setTempWebPort(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1024"
                    />
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Los puertos deben ser únicos y mayores a 1024
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handlePortsSubmit}
              className="w-full mt-6 bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 transition"
            >
              Siguiente →
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">
              Crear Administrador
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@empresa.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre Completo
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Juan Pérez"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre de Empresa (opcional)
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleFormChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mi Empresa S.A."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleFormChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Mínimo 8 caracteres
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleFormChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("ports")}
                className="flex-1 bg-gray-300 text-gray-800 font-medium py-2 rounded-md hover:bg-gray-400 transition"
              >
                ← Atrás
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {loading ? "Creando..." : "Crear Administrador"}
              </button>
            </div>
          </form>
        )}

        <p className="text-xs text-gray-500 text-center mt-6">
          Pymeshub Enterprise {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
