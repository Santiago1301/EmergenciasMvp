# Build desde la RAIZ del monorepo:
#   docker build -f services/s3-geospatial/Dockerfile -t s3-geospatial .

FROM public.ecr.aws/lambda/python:3.12 AS build
WORKDIR /build
COPY libs/emergencias_common ./libs/emergencias_common
COPY services/s3-geospatial/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --target /opt/python && \
    pip install --no-cache-dir ./libs/emergencias_common --target /opt/python

FROM public.ecr.aws/lambda/python:3.12
COPY --from=build /opt/python ${LAMBDA_TASK_ROOT}
COPY services/s3-geospatial/app ${LAMBDA_TASK_ROOT}/app
CMD ["app.main.handler"]
