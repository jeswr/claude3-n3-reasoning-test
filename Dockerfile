FROM python:2

RUN git clone https://github.com/linkeddata/swap

WORKDIR /swap
RUN git checkout 7a71cfd27e48aa79b1c111053d2ca58c2051a782
RUN sed -i '17i\import sys\' check.py*
RUN sed -i '18i\import os\' check.py*
RUN sed -i '19i\sys.path.append(os.getcwd())\' check.py*
WORKDIR /
CMD "python2" "swap/check.py" "./proof.n3"
