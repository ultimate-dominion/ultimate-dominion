import { Button, HStack, Input, Text } from '@chakra-ui/react';
import { useEffect, useMemo } from 'react';
import { FaBackwardStep, FaForwardStep } from 'react-icons/fa6';
import { IoCaretBack, IoCaretForward } from 'react-icons/io5';

export const Pagination = ({
  length,
  page,
  pageLimit,
  perPage,
  setPage,
  setPageLimit,
}: {
  length: number;
  page: number;
  pageLimit: number;
  perPage: number;
  setPage: (n: number) => void;
  setPageLimit: (n: number) => void;
}): JSX.Element => {
  const pageNumber = useMemo(() => {
    if (isNaN(Number(page))) {
      return 1;
    }
    return Number(page);
  }, [page]);

  useEffect(() => {
    if (pageNumber < 1) {
      return;
    }
    const _pageLimit = Math.floor(Math.ceil(length / perPage)) || 1;
    setPageLimit(_pageLimit);

    if (pageNumber > _pageLimit) {
      setPage(_pageLimit);
    }
  }, [length, pageNumber, perPage, setPage, setPageLimit]);

  return (
    <HStack my={5}>
      <Button
        onClick={() => setPage(1)}
        size="xs"
        visibility={pageNumber <= 1 ? 'hidden' : 'visible'}
      >
        <FaBackwardStep />
      </Button>
      <Button
        onClick={() => setPage(pageNumber == 1 ? 1 : pageNumber - 1)}
        size="xs"
        visibility={pageNumber <= 1 ? 'hidden' : 'visible'}
      >
        <IoCaretBack />
      </Button>
      <Input
        max={pageLimit}
        min={1}
        onChange={e => {
          const value = e.target.value;
          if (value === '') {
            setPage(Number(value));
            return;
          }
          if (isNaN(Number(value))) {
            return;
          }
          if (Number(value) < 1) {
            return;
          }
          if (Number(value) > pageLimit) {
            return;
          }
          setPage(Number(value));
        }}
        p={2}
        size="sm"
        value={page}
        w={10}
      />
      <Text size="sm">of {pageLimit}</Text>
      <Button
        onClick={() =>
          setPage(pageNumber < pageLimit ? pageNumber + 1 : pageNumber)
        }
        size="xs"
        visibility={pageNumber == pageLimit ? 'hidden' : 'visible'}
      >
        <IoCaretForward />
      </Button>
      <Button
        onClick={() => setPage(pageLimit)}
        size="xs"
        visibility={pageNumber == pageLimit ? 'hidden' : 'visible'}
      >
        <FaForwardStep />
      </Button>
    </HStack>
  );
};
