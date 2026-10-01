export type Face =
  | "champion-clash"
  | "champion-plot"
  | "ultimate"
  | "identity"
  | "follower-clash"
  | "follower-plot";

export type Side = "clash" | "plot";

export const SET: Face[] = [
  "champion-clash",
  "champion-plot",
  "ultimate",
  "identity",
  "follower-clash",
  "follower-plot",
];

export const FACE_LABEL: Record<Face, string> = {
  "champion-clash": "Champion · Clash",
  "champion-plot": "Champion · Plot",
  ultimate: "Ultimate",
  identity: "Identity",
  "follower-clash": "Follower · Clash",
  "follower-plot": "Follower · Plot",
};

export type Champion = { id: string; name: string };

export const CHAMPIONS: Champion[] = [
  { id: "ahsoka-tano", name: "Ahsoka Tano" },
  { id: "asajj-ventress", name: "Asajj Ventress" },
  { id: "bo-katan-kryze", name: "Bo-Katan Kryze" },
  { id: "boba-fett", name: "Boba Fett" },
  { id: "cad-bane", name: "Cad Bane" },
  { id: "captain-rex", name: "Captain Rex" },
  { id: "count-dooku", name: "Count Dooku" },
  { id: "darth-maul", name: "Darth Maul" },
  { id: "darth-vader", name: "Darth Vader" },
  { id: "emperor-palpatine", name: "Emperor Palpatine" },
  { id: "general-grievous", name: "General Grievous" },
  { id: "general-veers", name: "General Veers" },
  { id: "grand-admiral-thrawn", name: "Grand Admiral Thrawn" },
  { id: "han-solo", name: "Han Solo" },
  { id: "hondo-ohnaka", name: "Hondo Ohnaka" },
  { id: "ig-88", name: "IG-88" },
  { id: "jabba-the-hutt", name: "Jabba the Hutt" },
  { id: "kylo-ren", name: "Kylo Ren" },
  { id: "luke-skywalker", name: "Luke Skywalker" },
  { id: "mace-windu", name: "Mace Windu" },
  { id: "moff-gideon", name: "Moff Gideon" },
  { id: "obi-wan-kenobi", name: "Obi-Wan Kenobi" },
  { id: "princess-leia", name: "Princess Leia" },
  { id: "qui-gon-jinn", name: "Qui-Gon Jinn" },
  { id: "the-mandalorian", name: "The Mandalorian" },
  { id: "yoda", name: "Yoda" },
];

export function faceSrc(id: string, face: Face) {
  return `/cards/${id}/${face}.webp`;
}
