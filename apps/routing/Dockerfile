FROM ghcr.io/project-osrm/osrm-backend:v26.10.0-debian AS graph
WORKDIR /data
ADD --checksum=sha256:929e63a4641e57208b02848c1956afdf7a35bc45eed0bcf103a24ed172a4d543 https://download.geofabrik.de/central-america/costa-rica-261009.osm.pbf /data/costa-rica.osm.pbf
RUN osrm-extract -p /opt/car.lua costa-rica.osm.pbf \
    && osrm-partition costa-rica.osrm \
    && osrm-customize costa-rica.osrm \
    && rm costa-rica.osm.pbf

FROM ghcr.io/project-osrm/osrm-backend:v26.10.0-debian
COPY --from=graph /data/costa-rica.osrm* /data/
EXPOSE 5000
CMD ["osrm-routed", "--algorithm", "mld", "/data/costa-rica.osrm"]
