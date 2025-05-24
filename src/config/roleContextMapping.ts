export interface RoleContextMapping {
  [role: string]: {
    files: string[];
    directories: string[];
  };
}

export const roleContextMapping: RoleContextMapping = {
  public: {
    // No specific public procedures defined in the new document
    files: [],
    directories: [],
  },
  colaboradores: {
    files: [
      "Manual Geral Myo Clinic.txt",
      // Files from Processos_Software relevant to Colaboradores procedures
      "Processos_Software/Video#1-Apresentação SS.txt",
      "Processos_Software/Video#2 Gestão Cliente - Criar Cliente.txt",
      "Processos_Software/Vídeo3 - Contrato com Perfil.txt",
      "Processos_Software/Video#3.2 Alteração Contrato.txt",
      "Processos_Software/Video#4 Pagamentos.txt",
      "Processos_Software/Video#6 Cancelar Contrato + Ficheiro Morto.txt",
      "Processos_Software/Video#7 Gestão Cliente (DívidasMarcações).txt",
      "Processos_Software/ativar cliente.txt",
      "Processos_Software/Cliente suspenso.txt",
      "Processos_Software/contrato cliente - assinatura.txt",
      "Processos_Software/entradas+histórico cliente.txt", // For "Conta Corrente e Histórico de Pagamentos"
      // "Processos_Software/ficheiro debito.txt", // "Ficheiro de Débito" is listed for Managers
      "Processos_Software/notas e mensagens.txt",
      "Processos_Software/PAgamentos.txt",
    ],
    directories: [
      // Directories from Fisio - Cliente relevant to Colaboradores procedures
      "Fisio - Cliente/Chamadas para Leads", // For "Gestão de LEADs", "Contacto LEADs"
      "Fisio - Cliente/Avaliação de Diagnóstico", // For "Consentimento Informado (Fisioterapia)"
      // Not including "Fisio Técnico" based on the new document's procedure list for Colaboradores
    ],
  },
  managers: {
    files: ["Manual Geral Myo Clinic.txt"],
    directories: [
      "Processos_Software", // Full access for all financial and operational procedures
      "Fisio - Cliente", // Full access for client management and commercial processes
      "Fisio Técnico", // Access for deeper understanding and potentially for "Correção de Agenda" if it involves technicalities
    ],
  },
  franchising: {
    files: ["Manual Geral Myo Clinic.txt"],
    directories: [
      "Processos_Software", // Broad access similar to managers
      "Fisio - Cliente", // Broad access similar to managers
      "Fisio Técnico", // For understanding core business, quality control
    ],
  },
  admin_full_context: {
    files: [
      "Manual Geral Myo Clinic.txt",
      // instructions.md is handled separately and prepended globally
    ],
    directories: [
      "Processos_Software",
      "Fisio - Cliente",
      "Fisio Técnico",
      // Any other directories in context/ should be listed here for full admin access
    ],
  },
};
