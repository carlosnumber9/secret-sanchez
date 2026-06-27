export const demoGroup = {
  id: "demo-group",
  name: "Amigo Invisible Reyes 2027",
  year: 2027,
  status: "draft"
};

export const demoIslands = [
  {
    id: "island-irene",
    name: "Núcleo Irene",
    color: "#d6a84f",
    participants: [
      {
        id: "irene",
        name: "Irene",
        email: "irene@example.com",
        phone: "",
        preferredChannel: "email" as const,
        active: true,
        canGive: true,
        canReceive: true,
        familyIslandId: "island-irene"
      },
      {
        id: "carlos",
        name: "Carlos",
        email: "",
        phone: "+34 600 000 001",
        preferredChannel: "whatsapp" as const,
        active: true,
        canGive: true,
        canReceive: true,
        familyIslandId: "island-irene"
      },
      {
        id: "marta",
        name: "Marta",
        email: "marta@example.com",
        phone: "",
        preferredChannel: "email" as const,
        active: true,
        canGive: true,
        canReceive: true,
        familyIslandId: "island-irene"
      }
    ]
  },
  {
    id: "island-juan",
    name: "Núcleo Juan",
    color: "#b83232",
    participants: [
      {
        id: "juan",
        name: "Juan",
        email: "juan@example.com",
        phone: "+34 600 000 002",
        preferredChannel: "both" as const,
        active: true,
        canGive: true,
        canReceive: true,
        familyIslandId: "island-juan"
      },
      {
        id: "mari-cruz",
        name: "Mari Cruz",
        email: "",
        phone: "",
        preferredChannel: "manual" as const,
        active: true,
        canGive: true,
        canReceive: true,
        familyIslandId: "island-juan"
      }
    ]
  },
  {
    id: "island-cristina",
    name: "Núcleo Cristina",
    color: "#2f7d59",
    participants: [
      {
        id: "cristina",
        name: "Cristina",
        email: "cristina@example.com",
        phone: "",
        preferredChannel: "email" as const,
        active: true,
        canGive: true,
        canReceive: true,
        familyIslandId: "island-cristina"
      },
      {
        id: "jorge",
        name: "Jorge",
        email: "jorge@example.com",
        phone: "",
        preferredChannel: "email" as const,
        active: true,
        canGive: true,
        canReceive: true,
        familyIslandId: "island-cristina"
      },
      {
        id: "abel",
        name: "Abel",
        email: "",
        phone: "+34 600 000 003",
        preferredChannel: "whatsapp" as const,
        active: true,
        canGive: true,
        canReceive: true,
        familyIslandId: "island-cristina"
      }
    ]
  }
];

export const demoParticipants = demoIslands.flatMap((island) =>
  island.participants.map((participant) => ({
    ...participant,
    familyIslandId: island.id
  }))
);

export const demoDeliveries = [
  {
    id: "carlos",
    name: "Carlos",
    emailStatus: "missing" as const,
    whatsappStatus: "pending" as const,
    revealUrl: "http://localhost:4321/r/demo"
  },
  {
    id: "irene",
    name: "Irene",
    emailStatus: "sent" as const,
    whatsappStatus: "missing" as const,
    revealUrl: "http://localhost:4321/r/demo"
  },
  {
    id: "marta",
    name: "Marta",
    emailStatus: "sent" as const,
    whatsappStatus: "missing" as const,
    revealUrl: "http://localhost:4321/r/demo"
  },
  {
    id: "juan",
    name: "Juan",
    emailStatus: "failed" as const,
    whatsappStatus: "pending" as const,
    revealUrl: "http://localhost:4321/r/demo"
  }
];

export function getDemoStats() {
  const participantCount = demoParticipants.filter((participant) => participant.active).length;
  const missingContactCount = demoParticipants.filter((participant) => !participant.email && !participant.phone).length;

  return {
    participantCount,
    missingContactCount,
    islandCount: demoIslands.length
  };
}
