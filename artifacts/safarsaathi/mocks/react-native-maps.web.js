const React = require("react");
const { View, Text } = require("react-native");

function MapView({ children, style }) {
  return React.createElement(
    View,
    {
      style: [
        { backgroundColor: "#E8EFF8", flex: 1, alignItems: "center", justifyContent: "center" },
        style,
      ],
    },
    React.createElement(
      Text,
      { style: { color: "#1E3A8A", fontWeight: "600", fontSize: 16 } },
      "Map (Mobile Only)"
    )
  );
}

function Marker() { return null; }
function Polyline() { return null; }
function Circle() { return null; }
function UrlTile() { return null; }

const PROVIDER_DEFAULT = null;
const PROVIDER_GOOGLE = "google";

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = Marker;
module.exports.Polyline = Polyline;
module.exports.Circle = Circle;
module.exports.UrlTile = UrlTile;
module.exports.PROVIDER_DEFAULT = PROVIDER_DEFAULT;
module.exports.PROVIDER_GOOGLE = PROVIDER_GOOGLE;
